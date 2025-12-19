import { Decimal } from '@prisma/client/runtime/library';

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE';

export interface SplitInput {
    userId: string;
    value?: number; // For EXACT: the amount, for PERCENTAGE: the percentage
}

export interface ResolvedSplit {
    userId: string;
    amount: Decimal;
}

/**
 * Resolves expense splits into exact DECIMAL amounts.
 * 
 * Design decisions:
 * - All splits are resolved to exact amounts at creation time
 * - This creates an immutable audit trail
 * - Remainder from rounding goes to the first participant (typically the payer)
 * 
 * Time complexity: O(n) where n is number of participants
 */
export function resolveSplits(
    totalAmount: Decimal,
    splitType: SplitType,
    participants: SplitInput[],
    payerId: string
): ResolvedSplit[] {
    if (participants.length === 0) {
        throw new Error('At least one participant is required');
    }

    switch (splitType) {
        case 'EQUAL':
            return resolveEqualSplit(totalAmount, participants);
        case 'EXACT':
            return resolveExactSplit(totalAmount, participants);
        case 'PERCENTAGE':
            return resolvePercentageSplit(totalAmount, participants);
        default:
            throw new Error(`Unknown split type: ${splitType}`);
    }
}

/**
 * Equal split: Divide amount equally among participants.
 * Handles remainder by adding it to the first participant.
 * 
 * Example: $100 / 3 = $33.33, $33.33, $33.34
 */
function resolveEqualSplit(
    totalAmount: Decimal,
    participants: SplitInput[]
): ResolvedSplit[] {
    const count = participants.length;

    // Calculate base amount per person (floored to 2 decimal places)
    const baseAmount = totalAmount.dividedBy(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);

    // Calculate remainder
    const totalBase = baseAmount.times(count);
    const remainder = totalAmount.minus(totalBase);

    return participants.map((p, index) => ({
        userId: p.userId,
        // Add remainder to first participant
        amount: index === 0 ? baseAmount.plus(remainder) : baseAmount,
    }));
}

/**
 * Exact split: Use provided exact amounts.
 * Validates that sum equals total amount.
 */
function resolveExactSplit(
    totalAmount: Decimal,
    participants: SplitInput[]
): ResolvedSplit[] {
    // Validate all participants have exact values
    for (const p of participants) {
        if (p.value === undefined || p.value < 0) {
            throw new Error(`Invalid exact amount for user ${p.userId}`);
        }
    }

    const sum = participants.reduce(
        (acc, p) => acc.plus(new Decimal(p.value!)),
        new Decimal(0)
    );

    // Allow small tolerance for floating point issues (0.01)
    if (sum.minus(totalAmount).abs().greaterThan(new Decimal('0.01'))) {
        throw new Error(
            `Exact split amounts (${sum.toString()}) don't equal total (${totalAmount.toString()})`
        );
    }

    return participants.map((p) => ({
        userId: p.userId,
        amount: new Decimal(p.value!).toDecimalPlaces(2),
    }));
}

/**
 * Percentage split: Calculate amounts based on percentages.
 * Validates that percentages sum to 100%.
 * Handles remainder from rounding.
 */
function resolvePercentageSplit(
    totalAmount: Decimal,
    participants: SplitInput[]
): ResolvedSplit[] {
    // Validate all participants have percentage values
    for (const p of participants) {
        if (p.value === undefined || p.value < 0 || p.value > 100) {
            throw new Error(`Invalid percentage for user ${p.userId}`);
        }
    }

    const totalPercentage = participants.reduce((acc, p) => acc + p.value!, 0);

    // Allow small tolerance
    if (Math.abs(totalPercentage - 100) > 0.01) {
        throw new Error(
            `Percentages must sum to 100, got ${totalPercentage}`
        );
    }

    // Calculate amounts
    const splits: ResolvedSplit[] = participants.map((p) => ({
        userId: p.userId,
        amount: totalAmount
            .times(p.value!)
            .dividedBy(100)
            .toDecimalPlaces(2, Decimal.ROUND_DOWN),
    }));

    // Calculate and distribute remainder
    const calculatedSum = splits.reduce(
        (acc, s) => acc.plus(s.amount),
        new Decimal(0)
    );
    const remainder = totalAmount.minus(calculatedSum);

    if (remainder.greaterThan(0)) {
        splits[0].amount = splits[0].amount.plus(remainder);
    }

    return splits;
}

/**
 * Validate split input based on type.
 * Returns array of error messages (empty if valid).
 */
export function validateSplitInput(
    splitType: SplitType,
    totalAmount: number,
    participants: SplitInput[]
): string[] {
    const errors: string[] = [];

    if (participants.length === 0) {
        errors.push('At least one participant is required');
    }

    if (totalAmount <= 0) {
        errors.push('Amount must be greater than 0');
    }

    // Check for duplicate users
    const userIds = participants.map(p => p.userId);
    const uniqueIds = new Set(userIds);
    if (uniqueIds.size !== userIds.length) {
        errors.push('Duplicate participants are not allowed');
    }

    if (splitType === 'EXACT') {
        const sum = participants.reduce((acc, p) => acc + (p.value || 0), 0);
        if (Math.abs(sum - totalAmount) > 0.01) {
            errors.push(`Exact amounts must sum to ${totalAmount}, got ${sum.toFixed(2)}`);
        }
    }

    if (splitType === 'PERCENTAGE') {
        const sum = participants.reduce((acc, p) => acc + (p.value || 0), 0);
        if (Math.abs(sum - 100) > 0.01) {
            errors.push(`Percentages must sum to 100, got ${sum.toFixed(2)}`);
        }
    }

    return errors;
}
