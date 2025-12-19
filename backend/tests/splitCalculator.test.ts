import { Decimal } from '@prisma/client/runtime/library';
import {
    resolveSplits,
    validateSplitInput,
    SplitInput,
} from '../src/utils/splitCalculator';

describe('splitCalculator', () => {
    describe('resolveSplits', () => {
        describe('EQUAL split', () => {
            it('should split amount equally among participants', () => {
                const totalAmount = new Decimal('100');
                const participants: SplitInput[] = [
                    { userId: 'user1' },
                    { userId: 'user2' },
                ];

                const result = resolveSplits(totalAmount, 'EQUAL', participants, 'user1');

                expect(result).toHaveLength(2);
                expect(result[0].amount.toString()).toBe('50');
                expect(result[1].amount.toString()).toBe('50');
            });

            it('should handle remainder by adding to first participant', () => {
                const totalAmount = new Decimal('100');
                const participants: SplitInput[] = [
                    { userId: 'user1' },
                    { userId: 'user2' },
                    { userId: 'user3' },
                ];

                const result = resolveSplits(totalAmount, 'EQUAL', participants, 'user1');

                expect(result).toHaveLength(3);
                // 100 / 3 = 33.33 each, with 0.01 remainder going to first
                expect(result[0].amount.toString()).toBe('33.34');
                expect(result[1].amount.toString()).toBe('33.33');
                expect(result[2].amount.toString()).toBe('33.33');

                // Verify sum equals total
                const sum = result.reduce((acc, r) => acc.plus(r.amount), new Decimal(0));
                expect(sum.toString()).toBe('100');
            });

            it('should throw error for empty participants', () => {
                const totalAmount = new Decimal('100');

                expect(() => {
                    resolveSplits(totalAmount, 'EQUAL', [], 'user1');
                }).toThrow('At least one participant is required');
            });
        });

        describe('EXACT split', () => {
            it('should use provided exact amounts', () => {
                const totalAmount = new Decimal('100');
                const participants: SplitInput[] = [
                    { userId: 'user1', value: 60 },
                    { userId: 'user2', value: 40 },
                ];

                const result = resolveSplits(totalAmount, 'EXACT', participants, 'user1');

                expect(result).toHaveLength(2);
                expect(result[0].amount.toString()).toBe('60');
                expect(result[1].amount.toString()).toBe('40');
            });

            it('should throw error when amounts do not sum to total', () => {
                const totalAmount = new Decimal('100');
                const participants: SplitInput[] = [
                    { userId: 'user1', value: 30 },
                    { userId: 'user2', value: 30 },
                ];

                expect(() => {
                    resolveSplits(totalAmount, 'EXACT', participants, 'user1');
                }).toThrow(/don't equal total/);
            });

            it('should allow small tolerance for floating point', () => {
                const totalAmount = new Decimal('100');
                const participants: SplitInput[] = [
                    { userId: 'user1', value: 50.005 },
                    { userId: 'user2', value: 49.995 },
                ];

                // Should not throw because difference is within 0.01 tolerance
                const result = resolveSplits(totalAmount, 'EXACT', participants, 'user1');
                expect(result).toHaveLength(2);
            });
        });

        describe('PERCENTAGE split', () => {
            it('should calculate amounts from percentages', () => {
                const totalAmount = new Decimal('200');
                const participants: SplitInput[] = [
                    { userId: 'user1', value: 75 },
                    { userId: 'user2', value: 25 },
                ];

                const result = resolveSplits(totalAmount, 'PERCENTAGE', participants, 'user1');

                expect(result).toHaveLength(2);
                expect(result[0].amount.toString()).toBe('150');
                expect(result[1].amount.toString()).toBe('50');
            });

            it('should throw error when percentages do not sum to 100', () => {
                const totalAmount = new Decimal('100');
                const participants: SplitInput[] = [
                    { userId: 'user1', value: 50 },
                    { userId: 'user2', value: 30 },
                ];

                expect(() => {
                    resolveSplits(totalAmount, 'PERCENTAGE', participants, 'user1');
                }).toThrow('Percentages must sum to 100');
            });

            it('should handle remainder from percentage calculation', () => {
                const totalAmount = new Decimal('100');
                const participants: SplitInput[] = [
                    { userId: 'user1', value: 33.33 },
                    { userId: 'user2', value: 33.33 },
                    { userId: 'user3', value: 33.34 },
                ];

                const result = resolveSplits(totalAmount, 'PERCENTAGE', participants, 'user1');

                // Sum should equal total
                const sum = result.reduce((acc, r) => acc.plus(r.amount), new Decimal(0));
                expect(sum.toString()).toBe('100');
            });
        });
    });

    describe('validateSplitInput', () => {
        it('should return error for empty participants', () => {
            const errors = validateSplitInput('EQUAL', 100, []);
            expect(errors).toContain('At least one participant is required');
        });

        it('should return error for zero amount', () => {
            const errors = validateSplitInput('EQUAL', 0, [{ userId: 'user1' }]);
            expect(errors).toContain('Amount must be greater than 0');
        });

        it('should return error for duplicate participants', () => {
            const errors = validateSplitInput('EQUAL', 100, [
                { userId: 'user1' },
                { userId: 'user1' },
            ]);
            expect(errors).toContain('Duplicate participants are not allowed');
        });

        it('should validate EXACT split sums correctly', () => {
            const errors = validateSplitInput('EXACT', 100, [
                { userId: 'user1', value: 30 },
                { userId: 'user2', value: 30 },
            ]);
            expect(errors.some(e => e.includes('must sum to 100'))).toBe(true);
        });

        it('should validate PERCENTAGE split sums to 100', () => {
            const errors = validateSplitInput('PERCENTAGE', 100, [
                { userId: 'user1', value: 40 },
                { userId: 'user2', value: 40 },
            ]);
            expect(errors.some(e => e.includes('must sum to 100'))).toBe(true);
        });

        it('should return no errors for valid EQUAL split', () => {
            const errors = validateSplitInput('EQUAL', 100, [
                { userId: 'user1' },
                { userId: 'user2' },
            ]);
            expect(errors).toHaveLength(0);
        });
    });
});
