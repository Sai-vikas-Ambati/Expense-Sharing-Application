import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authMiddleware, AuthRequest } from '../../middleware/auth';

const router = Router();

// All group routes require authentication
router.use(authMiddleware);

// Validation schemas
const createGroupSchema = z.object({
    name: z.string().min(1, 'Group name is required'),
    description: z.string().optional(),
});

const addMemberSchema = z.object({
    email: z.string().email('Invalid email'),
});

/**
 * GET /api/groups
 * List all groups the user is a member of
 */
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const groups = await prisma.group.findMany({
            where: {
                members: {
                    some: {
                        userId: req.userId,
                    },
                },
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        expenses: true,
                    },
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });

        // Calculate user's balance in each group
        const groupsWithBalance = groups.map(group => {
            const userMember = group.members.find(m => m.userId === req.userId);
            return {
                ...group,
                userBalance: userMember?.balance || 0,
            };
        });

        res.json({ groups: groupsWithBalance });
    } catch (error) {
        console.error('List groups error:', error);
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
});

/**
 * POST /api/groups
 * Create a new group (creator is automatically added as member)
 */
router.post('/', async (req: AuthRequest, res: Response) => {
    try {
        const validated = createGroupSchema.parse(req.body);

        const group = await prisma.group.create({
            data: {
                name: validated.name,
                description: validated.description,
                members: {
                    create: {
                        userId: req.userId!,
                    },
                },
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        res.status(201).json({ group });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
            return;
        }
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
});

/**
 * GET /api/groups/:id
 * Get group details including members and balances
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const group = await prisma.group.findFirst({
            where: {
                id: req.params.id,
                members: {
                    some: {
                        userId: req.userId,
                    },
                },
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                },
            },
        });

        if (!group) {
            res.status(404).json({ error: 'Group not found' });
            return;
        }

        res.json({ group });
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Failed to fetch group' });
    }
});

/**
 * POST /api/groups/:id/members
 * Add a member to the group by email
 */
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
    try {
        const validated = addMemberSchema.parse(req.body);

        // Verify user is a member of this group
        const existingMember = await prisma.groupMember.findFirst({
            where: {
                groupId: req.params.id,
                userId: req.userId,
            },
        });

        if (!existingMember) {
            res.status(403).json({ error: 'Not a member of this group' });
            return;
        }

        // Find user by email
        const userToAdd = await prisma.user.findUnique({
            where: { email: validated.email },
        });

        if (!userToAdd) {
            res.status(404).json({ error: 'User not found with that email' });
            return;
        }

        // Check if already a member
        const alreadyMember = await prisma.groupMember.findUnique({
            where: {
                userId_groupId: {
                    userId: userToAdd.id,
                    groupId: req.params.id,
                },
            },
        });

        if (alreadyMember) {
            res.status(400).json({ error: 'User is already a member' });
            return;
        }

        // Add member
        const member = await prisma.groupMember.create({
            data: {
                userId: userToAdd.id,
                groupId: req.params.id,
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

        res.status(201).json({ member });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors[0].message });
            return;
        }
        console.error('Add member error:', error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

export default router;
