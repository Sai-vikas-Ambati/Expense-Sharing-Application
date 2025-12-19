import { Router, Response } from 'express';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';
import { simplifyBalances, UserBalance } from '../../utils/balanceSimplifier';

const router = Router();

// All settlement routes require authentication
router.use(authMiddleware);

// Validation schema
const createSettlementSchema = z.object({
    toUserId: z.string().uuid('Invalid user ID'),
    amount: z.number().positive('Amount must be positive'),
});

/**
 * GET /api/groups/:groupId/balances
 * Get all member balances and simplified settlements for a group
 */
router.get('/:groupId/balances', async (req: AuthRequest, res: Response) => {
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

        // Get all member balances
        const members = await prisma.groupMember.findMany({
            where: {
                groupId: req.params.groupId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        // Format balances
        const balances = members.map(m => ({
            userId: m.userId,
            userName: m.user.name,
            userEmail: m.user.email,
            balance: parseFloat(m.balance.toString()),
        }));

        // Calculate simplified settlements
        const userBalances: UserBalance[] = members.map(m => ({
            userId: m.userId,
            balance: new Decimal(m.balance.toString()),
        }));

        const simplifiedSettlements = simplifyBalances(userBalances);

        // Format settlements with user names
        const userMap = new Map(members.map(m => [m.userId, m.user.name]));

        const settlements = simplifiedSettlements.map(s => ({
            fromUserId: s.fromUserId,
            fromUserName: userMap.get(s.fromUserId) || 'Unknown',
            toUserId: s.toUserId,
            toUserName: userMap.get(s.toUserId) || 'Unknown',
            amount: parseFloat(s.amount.toString()),
        }));

        // Calculate user's total owed/owes
        const userBalance = balances.find(b => b.userId === req.userId);

        res.json({
            balances,
            settlements,
            userSummary: {
                balance: userBalance?.balance || 0,
                isOwed: (userBalance?.balance || 0) > 0,
                owes: (userBalance?.balance || 0) < 0,
            },
        });
    } catch (error) {
        console.error('Get balances error:', error);
        res.status(500).json({ error: 'Failed to fetch balances' });
    }
});

/**
 * POST /api/groups/:groupId/settlements
 * Record a settlement (payment) between two users
 */
router.post('/:groupId/settlements', async (req: AuthRequest, res: Response) => {
    try {
        const validated = createSettlementSchema.parse(req.body);
        const groupId = req.params.groupId;
        const fromUserId = req.userId!;
        const toUserId = validated.toUserId;
        const amount = new Decimal(validated.amount);

        // Can't settle with yourself
        if (fromUserId === toUserId) {
            res.status(400).json({ error: 'Cannot settle with yourself' });
            return;
        }

        // Verify both users are members
        const members = await prisma.groupMember.findMany({
            where: {
                groupId,
                userId: { in: [fromUserId, toUserId] },
            },
        });

        if (members.length !== 2) {
            res.status(400).json({ error: 'Both users must be members of this group' });
            return;
        }

        // Create settlement and update balances in transaction
        const settlement = await prisma.$transaction(async (tx) => {
            // Create settlement record
            const newSettlement = await tx.settlement.create({
                data: {
                    groupId,
                    fromUserId,
                    toUserId,
                    amount,
                },
                include: {
                    fromUser: {
                        select: { id: true, name: true },
                    },
                    toUser: {
                        select: { id: true, name: true },
                    },
                },
            });

            // Update balances
            // Payer (fromUser) balance increases (less debt)
            await tx.groupMember.update({
                where: {
                    userId_groupId: {
                        userId: fromUserId,
                        groupId,
                    },
                },
                data: {
                    balance: {
                        increment: amount,
                    },
                },
            });

            // Receiver (toUser) balance decreases (less credit)
            await tx.groupMember.update({
                where: {
                    userId_groupId: {
                        userId: toUserId,
                        groupId,
                    },
                },
                data: {
                    balance: {
                        decrement: amount,
                    },
                },
            });

            return newSettlement;
        });

        res.status(201).json({ settlement });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
            return;
        }
        console.error('Create settlement error:', error);
        res.status(500).json({ error: 'Failed to create settlement' });
    }
});

/**
 * GET /api/groups/:groupId/settlements
 * List all settlements in a group
 */
router.get('/:groupId/settlements', async (req: AuthRequest, res: Response) => {
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

        const settlements = await prisma.settlement.findMany({
            where: {
                groupId: req.params.groupId,
            },
            include: {
                fromUser: {
                    select: { id: true, name: true },
                },
                toUser: {
                    select: { id: true, name: true },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        res.json({ settlements });
    } catch (error) {
        console.error('List settlements error:', error);
        res.status(500).json({ error: 'Failed to fetch settlements' });
    }
});

export default router;
