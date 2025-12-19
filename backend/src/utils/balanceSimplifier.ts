import { Decimal } from '@prisma/client/runtime/library';

export interface UserBalance {
    userId: string;
    balance: Decimal; // Positive = creditor, Negative = debtor
}

export interface Settlement {
    fromUserId: string;
    toUserId: string;
    amount: Decimal;
}

/**
 * Greedy algorithm to simplify balances into minimum number of transfers.
 * 
 * Algorithm:
 * 1. Separate users into creditors (positive balance) and debtors (negative balance)
 * 2. Sort each by absolute value (descending)
 * 3. Match largest creditor with largest debtor
 * 4. Transfer min(credit, |debt|)
 * 5. Update balances, remove zeros
 * 6. Repeat until all settled
 * 
 * Time complexity: O(n log n) for sorting, O(n) for matching
 * Space complexity: O(n)
 * 
 * Example:
 * Input:  A: -8, B: +5, C: +3 (A owes $8, B is owed $5, C is owed $3)
 * Output: [A pays B $5, A pays C $3]
 */
export function simplifyBalances(balances: UserBalance[]): Settlement[] {
    const settlements: Settlement[] = [];

    // Filter out zero balances and create mutable copies
    const creditors: UserBalance[] = [];
    const debtors: UserBalance[] = [];

    for (const b of balances) {
        if (b.balance.greaterThan(0)) {
            creditors.push({ userId: b.userId, balance: b.balance });
        } else if (b.balance.lessThan(0)) {
            debtors.push({ userId: b.userId, balance: b.balance.abs() }); // Store as positive for easier comparison
        }
    }

    // Sort by balance (descending) for greedy matching
    const sortByBalance = (a: UserBalance, b: UserBalance) =>
        b.balance.minus(a.balance).toNumber();

    creditors.sort(sortByBalance);
    debtors.sort(sortByBalance);

    let creditorIdx = 0;
    let debtorIdx = 0;

    while (creditorIdx < creditors.length && debtorIdx < debtors.length) {
        const creditor = creditors[creditorIdx];
        const debtor = debtors[debtorIdx];

        // Transfer amount is the minimum of credit and debt
        const transferAmount = Decimal.min(creditor.balance, debtor.balance);

        if (transferAmount.greaterThan(0)) {
            settlements.push({
                fromUserId: debtor.userId,
                toUserId: creditor.userId,
                amount: transferAmount.toDecimalPlaces(2),
            });
        }

        // Update balances
        creditor.balance = creditor.balance.minus(transferAmount);
        debtor.balance = debtor.balance.minus(transferAmount);

        // Move to next if settled
        if (creditor.balance.lessThanOrEqualTo(0)) {
            creditorIdx++;
        }
        if (debtor.balance.lessThanOrEqualTo(0)) {
            debtorIdx++;
        }
    }

    return settlements;
}

/**
 * Calculate net balances from a list of pairwise balances.
 * Used to compute simplified settlements from current group state.
 */
export function calculateNetBalances(
    pairwiseBalances: Map<string, Decimal>
): UserBalance[] {
    const netBalances = new Map<string, Decimal>();

    for (const [userId, balance] of pairwiseBalances.entries()) {
        netBalances.set(userId, balance);
    }

    return Array.from(netBalances.entries()).map(([userId, balance]) => ({
        userId,
        balance,
    }));
}

/**
 * Format settlements for display.
 * Returns human-readable descriptions.
 */
export function formatSettlements(
    settlements: Settlement[],
    getUserName: (userId: string) => string
): string[] {
    return settlements.map(s =>
        `${getUserName(s.fromUserId)} pays ${getUserName(s.toUserId)} $${s.amount.toFixed(2)}`
    );
}
