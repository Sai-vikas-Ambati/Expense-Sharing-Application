import { Decimal } from '@prisma/client/runtime/library';
import {
    simplifyBalances,
    UserBalance,
} from '../src/utils/balanceSimplifier';

describe('balanceSimplifier', () => {
    describe('simplifyBalances', () => {
        it('should return empty array when all balances are zero', () => {
            const balances: UserBalance[] = [
                { userId: 'user1', balance: new Decimal(0) },
                { userId: 'user2', balance: new Decimal(0) },
            ];

            const result = simplifyBalances(balances);
            expect(result).toHaveLength(0);
        });

        it('should handle single debtor and single creditor', () => {
            const balances: UserBalance[] = [
                { userId: 'creditor', balance: new Decimal(50) },
                { userId: 'debtor', balance: new Decimal(-50) },
            ];

            const result = simplifyBalances(balances);

            expect(result).toHaveLength(1);
            expect(result[0].fromUserId).toBe('debtor');
            expect(result[0].toUserId).toBe('creditor');
            expect(result[0].amount.toString()).toBe('50');
        });

        it('should minimize transfers in circular debt scenario', () => {
            // A owes B $5, B owes C $10, A owes C $3
            // Net: A = -8, B = +5, C = +3
            const balances: UserBalance[] = [
                { userId: 'A', balance: new Decimal(-8) },
                { userId: 'B', balance: new Decimal(5) },
                { userId: 'C', balance: new Decimal(3) },
            ];

            const result = simplifyBalances(balances);

            // Should produce 2 transfers: A -> B $5, A -> C $3
            expect(result).toHaveLength(2);

            const totalPaid = result.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));
            expect(totalPaid.toString()).toBe('8');
        });

        it('should handle multiple creditors and debtors', () => {
            const balances: UserBalance[] = [
                { userId: 'creditor1', balance: new Decimal(30) },
                { userId: 'creditor2', balance: new Decimal(20) },
                { userId: 'debtor1', balance: new Decimal(-25) },
                { userId: 'debtor2', balance: new Decimal(-25) },
            ];

            const result = simplifyBalances(balances);

            // Total credits = 50, total debts = 50
            const totalTransferred = result.reduce(
                (sum, r) => sum.plus(r.amount),
                new Decimal(0)
            );
            expect(totalTransferred.toString()).toBe('50');

            // Verify all settlements flow from debtors to creditors
            result.forEach((settlement) => {
                expect(['debtor1', 'debtor2']).toContain(settlement.fromUserId);
                expect(['creditor1', 'creditor2']).toContain(settlement.toUserId);
            });
        });

        it('should handle when one person owes multiple others', () => {
            const balances: UserBalance[] = [
                { userId: 'bigDebtor', balance: new Decimal(-100) },
                { userId: 'creditor1', balance: new Decimal(40) },
                { userId: 'creditor2', balance: new Decimal(35) },
                { userId: 'creditor3', balance: new Decimal(25) },
            ];

            const result = simplifyBalances(balances);

            // Should have 3 settlements from bigDebtor
            expect(result.every(s => s.fromUserId === 'bigDebtor')).toBe(true);
            expect(result).toHaveLength(3);

            const totalPaid = result.reduce((sum, r) => sum.plus(r.amount), new Decimal(0));
            expect(totalPaid.toString()).toBe('100');
        });

        it('should skip zero balance users', () => {
            const balances: UserBalance[] = [
                { userId: 'creditor', balance: new Decimal(50) },
                { userId: 'neutral', balance: new Decimal(0) },
                { userId: 'debtor', balance: new Decimal(-50) },
            ];

            const result = simplifyBalances(balances);

            expect(result).toHaveLength(1);
            // neutral should not appear in any settlement
            result.forEach((settlement) => {
                expect(settlement.fromUserId).not.toBe('neutral');
                expect(settlement.toUserId).not.toBe('neutral');
            });
        });

        it('should produce optimal number of settlements', () => {
            // Worst case: n-1 settlements for n participants
            const balances: UserBalance[] = [
                { userId: 'user1', balance: new Decimal(10) },
                { userId: 'user2', balance: new Decimal(20) },
                { userId: 'user3', balance: new Decimal(-15) },
                { userId: 'user4', balance: new Decimal(-15) },
            ];

            const result = simplifyBalances(balances);

            // With 4 participants and 2 creditors + 2 debtors,
            // optimal is at most 3 settlements (n-1 = 4-1 = 3)
            expect(result.length).toBeLessThanOrEqual(3);
        });
    });
});
