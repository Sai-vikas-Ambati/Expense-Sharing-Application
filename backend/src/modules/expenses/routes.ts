import { Router, Response } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { resolveSplits, validateSplitInput, SplitType } from '../../utils/splitCalculator';

const router = Router();

// All expense routes require authentication
router.use(authMiddleware);

// Validation schemas
const splitParticipantSchema = z.object({
    userId: z.string().uuid(),
    value: z.number().optional(), // For EXACT/PERCENTAGE
});

const createExpenseSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    description: z.string().min(1, 'Description is required'),
    splitType: z.enum(['EQUAL', 'EXACT', 'PERCENTAGE']),
    participants: z.array(splitParticipantSchema).min(1, 'At least one participant required'),
});

/**
 * GET /api/groups/:groupId/expenses
 * List all expenses in a group
 */
router.get('/:groupId/expenses', async (req: AuthRequest, res: Response) => {
    try {
        // Verify user is a member
        const membership = await prisma.groupMember.findFirst({
            where: {
                groupId: req.params.groupId,
                userId: req.userId,
            },
        });

        if (!membership) {
            res.status(403).json({ error: 'Not a member of this group' });
            return;
        }

        const expenses = await prisma.expense.findMany({
            where: {
                groupId: req.params.groupId,
            },
            include: {
                payer: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                splits: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.json({ expenses });
    } catch (error) {
        console.error('List expenses error:', error);
        res.status(500).json({ error: 'Failed to fetch expenses' });
    }
});

/**
 * POST /api/groups/:groupId/expenses
 * Create a new expense with splits
 * 
 * This is transactional:
 * 1. Create expense record
 * 2. Create split records (resolved to exact amounts)
 * 3. Update ledger balances for all affected members
 */
router.post('/:groupId/expenses', async (req: AuthRequest, res: Response) => {
    try {
        const validated = createExpenseSchema.parse(req.body);
        const groupId = req.params.groupId;

        // Verify user is a member and get all members
        const members = await prisma.groupMember.findMany({
            where: { groupId },
            include: {
                user: {
                    select: { id: true },
                },
            },
        });

        const memberIds = members.map(m => m.userId);

        if (!memberIds.includes(req.userId!)) {
            res.status(403).json({ error: 'Not a member of this group' });
            return;
        }

        // Validate all participants are group members
        for (const p of validated.participants) {
            if (!memberIds.includes(p.userId)) {
                res.status(400).json({ error: `User ${p.userId} is not a member of this group` });
                return;
            }
        }

        // Validate split input
        const validationErrors = validateSplitInput(
            validated.splitType as SplitType,
            validated.amount,
            validated.participants
        );

        if (validationErrors.length > 0) {
            res.status(400).json({ error: validationErrors[0] });
            return;
        }

        // Resolve splits to exact amounts
        const totalAmount = new Decimal(validated.amount);
        const resolvedSplits = resolveSplits(
            totalAmount,
            validated.splitType as SplitType,
            validated.participants,
            req.userId!
        );

        // Create expense and update balances in a transaction
        const expense = await prisma.$transaction(async (tx) => {
            // Create expense
            const newExpense = await tx.expense.create({
                data: {
                    groupId,
                    payerId: req.userId!,
                    amount: totalAmount,
                    description: validated.description,
                    splitType: validated.splitType,
                    splits: {
                        create: resolvedSplits.map(s => ({
                            userId: s.userId,
                            amount: s.amount,
                        })),
                    },
                },
                include: {
                    payer: {
                        select: { id: true, name: true },
                    },
                    splits: {
                        include: {
                            user: {
                                select: { id: true, name: true },
                            },
                        },
                    },
                },
            });

            // Update ledger balances
            // Payer's balance increases (they are owed money)
            // Each split participant's balance decreases (they owe money)

            // First, credit the payer with the full amount
            await tx.groupMember.update({
                where: {
                    userId_groupId: {
                        userId: req.userId!,
                        groupId,
                    },
                },
                data: {
                    balance: {
                        increment: totalAmount,
                    },
                },
            });

            // Then, debit each participant for their share
            for (const split of resolvedSplits) {
                await tx.groupMember.update({
                    where: {
                        userId_groupId: {
                            userId: split.userId,
                            groupId,
                        },
                    },
                    data: {
                        balance: {
                            decrement: split.amount,
                        },
                    },
                });
            }

            return newExpense;
        });

        res.status(201).json({ expense });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
            return;
        }
        console.error('Create expense error:', error);
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

/**
 * DELETE /api/groups/:groupId/expenses/:expenseId
 * Delete an expense and reverse balance changes
 */
router.delete('/:groupId/expenses/:expenseId', async (req: AuthRequest, res: Response) => {
    try {
        const { groupId, expenseId } = req.params;

        // Get the expense with splits
        const expense = await prisma.expense.findFirst({
            where: {
                id: expenseId,
                groupId,
            },
            include: {
                splits: true,
            },
        });

        if (!expense) {
            res.status(404).json({ error: 'Expense not found' });
            return;
        }

        // Only payer can delete the expense
        if (expense.payerId !== req.userId) {
            res.status(403).json({ error: 'Only the payer can delete this expense' });
            return;
        }

        // Reverse balance changes and delete in transaction
        await prisma.$transaction(async (tx) => {
            // Reverse payer credit
            await tx.groupMember.update({
                where: {
                    userId_groupId: {
                        userId: expense.payerId,
                        groupId,
                    },
                },
                data: {
                    balance: {
                        decrement: expense.amount,
                    },
                },
            });

            // Reverse participant debits
            for (const split of expense.splits) {
                await tx.groupMember.update({
                    where: {
                        userId_groupId: {
                            userId: split.userId,
                            groupId,
                        },
                    },
                    data: {
                        balance: {
                            increment: split.amount,
                        },
                    },
                });
            }

            // Delete expense (cascades to splits)
            await tx.expense.delete({
                where: { id: expenseId },
            });
        });

        res.json({ message: 'Expense deleted' });
    } catch (error) {
        console.error('Delete expense error:', error);
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

export default router;
