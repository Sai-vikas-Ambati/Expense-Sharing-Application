import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { groupsApi, expensesApi, settlementsApi } from '../lib/api';
import { formatCurrency, formatDate, getInitials } from '../lib/utils';
import {
    ArrowLeft,
    Users,
    Plus,
    Receipt,
    ArrowRightLeft,
    UserPlus,
    Loader2,
    X,
    Trash2,
    Check,
} from 'lucide-react';
import { toast } from 'sonner';

type Tab = 'expenses' | 'balances' | 'settlements';

export default function GroupDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('expenses');
    const [showAddExpense, setShowAddExpense] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [showSettleUp, setShowSettleUp] = useState(false);

    const { data: groupData, isLoading: groupLoading } = useQuery({
        queryKey: ['group', id],
        queryFn: async () => {
            const response = await groupsApi.get(id!);
            return response.data.group;
        },
    });

    const { data: expensesData, isLoading: expensesLoading } = useQuery({
        queryKey: ['expenses', id],
        queryFn: async () => {
            const response = await expensesApi.list(id!);
            return response.data.expenses;
        },
    });

    const { data: balancesData, isLoading: balancesLoading } = useQuery({
        queryKey: ['balances', id],
        queryFn: async () => {
            const response = await settlementsApi.getBalances(id!);
            return response.data;
        },
    });

    if (groupLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!groupData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-slate-400">Group not found</p>
            </div>
        );
    }

    const group = groupData;
    const expenses = expensesData || [];
    const balances = balancesData?.balances || [];
    const settlements = balancesData?.settlements || [];
    const userSummary = balancesData?.userSummary || { balance: 0 };

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-lg sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4 mb-4">
                        <Link
                            to="/"
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">{group.name}</h1>
                            {group.description && (
                                <p className="text-sm text-slate-400">{group.description}</p>
                            )}
                        </div>
                    </div>

                    {/* Balance Summary */}
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <span className="text-sm text-slate-400">Your balance</span>
                            <p className={`text-2xl font-bold ${userSummary.balance > 0
                                    ? 'text-emerald-400'
                                    : userSummary.balance < 0
                                        ? 'text-red-400'
                                        : 'text-slate-400'
                                }`}>
                                {userSummary.balance > 0 && '+'}
                                {formatCurrency(userSummary.balance)}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowAddMember(true)}
                                className="btn-secondary flex items-center gap-2"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span className="hidden sm:inline">Add Member</span>
                            </button>
                            <button
                                onClick={() => setShowAddExpense(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Add Expense</span>
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
                        {(['expenses', 'balances', 'settlements'] as Tab[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all capitalize ${activeTab === tab
                                        ? 'bg-blue-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6">
                {activeTab === 'expenses' && (
                    <ExpensesList expenses={expenses} isLoading={expensesLoading} groupId={id!} userId={user?.id} />
                )}
                {activeTab === 'balances' && (
                    <BalancesList
                        balances={balances}
                        settlements={settlements}
                        isLoading={balancesLoading}
                        onSettleUp={() => setShowSettleUp(true)}
                    />
                )}
                {activeTab === 'settlements' && (
                    <SettlementsList groupId={id!} />
                )}
            </main>

            {/* Modals */}
            {showAddExpense && (
                <AddExpenseModal
                    groupId={id!}
                    members={group.members || []}
                    onClose={() => setShowAddExpense(false)}
                />
            )}
            {showAddMember && (
                <AddMemberModal
                    groupId={id!}
                    onClose={() => setShowAddMember(false)}
                />
            )}
            {showSettleUp && (
                <SettleUpModal
                    groupId={id!}
                    settlements={settlements}
                    onClose={() => setShowSettleUp(false)}
                />
            )}
        </div>
    );
}

function ExpensesList({
    expenses,
    isLoading,
    groupId,
    userId
}: {
    expenses: any[];
    isLoading: boolean;
    groupId: string;
    userId?: string;
}) {
    const queryClient = useQueryClient();

    const deleteMutation = useMutation({
        mutationFn: (expenseId: string) => expensesApi.delete(groupId, expenseId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
            queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
            toast.success('Expense deleted');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to delete expense');
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (expenses.length === 0) {
        return (
            <div className="glass-card p-12 text-center">
                <Receipt className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No expenses yet</h3>
                <p className="text-slate-400">Add your first expense to get started</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {expenses.map((expense: any, index: number) => (
                <div
                    key={expense.id}
                    className="glass-card p-4 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mt-1">
                                <Receipt className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h4 className="font-medium text-white">{expense.description}</h4>
                                <p className="text-sm text-slate-400">
                                    Paid by {expense.payer.name} • {formatDate(expense.createdAt)}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    Split: {expense.splitType.toLowerCase()} ({expense.splits.length} people)
                                </p>
                            </div>
                        </div>
                        <div className="text-right flex items-start gap-2">
                            <div>
                                <p className="text-lg font-semibold text-white">
                                    {formatCurrency(parseFloat(expense.amount))}
                                </p>
                            </div>
                            {expense.payer.id === userId && (
                                <button
                                    onClick={() => deleteMutation.mutate(expense.id)}
                                    disabled={deleteMutation.isPending}
                                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                    title="Delete expense"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

function BalancesList({
    balances,
    settlements,
    isLoading,
    onSettleUp,
}: {
    balances: any[];
    settlements: any[];
    isLoading: boolean;
    onSettleUp: () => void;
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Member Balances */}
            <div>
                <h3 className="text-lg font-medium text-white mb-4">Member Balances</h3>
                <div className="space-y-2">
                    {balances.map((balance: any, index: number) => (
                        <div
                            key={balance.userId}
                            className="glass-card p-4 flex items-center justify-between animate-fade-in"
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                                    {getInitials(balance.userName)}
                                </div>
                                <div>
                                    <p className="font-medium text-white">{balance.userName}</p>
                                    <p className="text-sm text-slate-400">{balance.userEmail}</p>
                                </div>
                            </div>
                            <p className={`text-lg font-semibold ${balance.balance > 0
                                    ? 'text-emerald-400'
                                    : balance.balance < 0
                                        ? 'text-red-400'
                                        : 'text-slate-400'
                                }`}>
                                {balance.balance > 0 ? '+' : ''}{formatCurrency(balance.balance)}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Simplified Settlements */}
            {settlements.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-white">Suggested Settlements</h3>
                        <button onClick={onSettleUp} className="btn-primary text-sm py-2">
                            Settle Up
                        </button>
                    </div>
                    <div className="space-y-2">
                        {settlements.map((settlement: any, index: number) => (
                            <div
                                key={index}
                                className="glass-card p-4 flex items-center justify-between animate-fade-in"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className="flex items-center gap-3">
                                    <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                                    <span className="text-white">
                                        <span className="font-medium">{settlement.fromUserName}</span>
                                        <span className="text-slate-400"> pays </span>
                                        <span className="font-medium">{settlement.toUserName}</span>
                                    </span>
                                </div>
                                <p className="text-lg font-semibold text-blue-400">
                                    {formatCurrency(settlement.amount)}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SettlementsList({ groupId }: { groupId: string }) {
    const { data, isLoading } = useQuery({
        queryKey: ['settlement-history', groupId],
        queryFn: async () => {
            const response = await settlementsApi.list(groupId);
            return response.data.settlements;
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    const settlements = data || [];

    if (settlements.length === 0) {
        return (
            <div className="glass-card p-12 text-center">
                <ArrowRightLeft className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No settlements yet</h3>
                <p className="text-slate-400">Settlements will appear here when members pay each other</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {settlements.map((settlement: any, index: number) => (
                <div
                    key={settlement.id}
                    className="glass-card p-4 animate-fade-in"
                    style={{ animationDelay: `${index * 0.05}s` }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <Check className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">
                                    {settlement.fromUser.name} → {settlement.toUser.name}
                                </p>
                                <p className="text-sm text-slate-400">{formatDate(settlement.createdAt)}</p>
                            </div>
                        </div>
                        <p className="text-lg font-semibold text-emerald-400">
                            {formatCurrency(parseFloat(settlement.amount))}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

function AddExpenseModal({
    groupId,
    members,
    onClose
}: {
    groupId: string;
    members: any[];
    onClose: () => void;
}) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [splitType, setSplitType] = useState<'EQUAL' | 'EXACT' | 'PERCENTAGE'>('EQUAL');
    const [participants, setParticipants] = useState<{ userId: string; value: string; selected: boolean }[]>(
        members.map((m: any) => ({ userId: m.user.id, value: '', selected: true }))
    );

    const selectedParticipants = participants.filter(p => p.selected);
    const amountNum = parseFloat(amount) || 0;

    // Validation
    let isValid = amountNum > 0 && description && selectedParticipants.length > 0;
    let validationError = '';

    if (splitType === 'EXACT') {
        const sum = selectedParticipants.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
        if (Math.abs(sum - amountNum) > 0.01) {
            isValid = false;
            validationError = `Amounts must sum to ${formatCurrency(amountNum)} (current: ${formatCurrency(sum)})`;
        }
    } else if (splitType === 'PERCENTAGE') {
        const sum = selectedParticipants.reduce((s, p) => s + (parseFloat(p.value) || 0), 0);
        if (Math.abs(sum - 100) > 0.01) {
            isValid = false;
            validationError = `Percentages must sum to 100% (current: ${sum.toFixed(1)}%)`;
        }
    }

    const createMutation = useMutation({
        mutationFn: () => {
            const data = {
                amount: amountNum,
                description,
                splitType,
                participants: selectedParticipants.map(p => ({
                    userId: p.userId,
                    ...(splitType !== 'EQUAL' && { value: parseFloat(p.value) || 0 }),
                })),
            };
            return expensesApi.create(groupId, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['expenses', groupId] });
            queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            toast.success('Expense added!');
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to add expense');
        },
    });

    const getMemberName = (userId: string) => {
        const member = members.find((m: any) => m.user.id === userId);
        return member?.user.name || 'Unknown';
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
            <div className="glass-card w-full max-w-lg p-6 my-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Add Expense</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        createMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Amount
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="input-field text-2xl font-semibold"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Description
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What was this for?"
                            className="input-field"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Split Type
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['EQUAL', 'EXACT', 'PERCENTAGE'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSplitType(type)}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${splitType === type
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                        }`}
                                >
                                    {type.charAt(0) + type.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Split Between
                        </label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {participants.map((p, index) => (
                                <div
                                    key={p.userId}
                                    className={`p-3 rounded-lg border transition-all ${p.selected
                                            ? 'bg-slate-700/50 border-blue-500/50'
                                            : 'bg-slate-800/50 border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                                            <input
                                                type="checkbox"
                                                checked={p.selected}
                                                onChange={(e) => {
                                                    const newParticipants = [...participants];
                                                    newParticipants[index].selected = e.target.checked;
                                                    setParticipants(newParticipants);
                                                }}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                                            />
                                            <span className="text-white">{getMemberName(p.userId)}</span>
                                            {p.userId === user?.id && (
                                                <span className="text-xs text-blue-400">(you)</span>
                                            )}
                                        </label>

                                        {p.selected && splitType !== 'EQUAL' && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={p.value}
                                                    onChange={(e) => {
                                                        const newParticipants = [...participants];
                                                        newParticipants[index].value = e.target.value;
                                                        setParticipants(newParticipants);
                                                    }}
                                                    placeholder="0"
                                                    className="w-24 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-right text-sm"
                                                />
                                                <span className="text-slate-400 text-sm w-6">
                                                    {splitType === 'PERCENTAGE' ? '%' : '$'}
                                                </span>
                                            </div>
                                        )}

                                        {p.selected && splitType === 'EQUAL' && amountNum > 0 && (
                                            <span className="text-slate-400 text-sm">
                                                {formatCurrency(amountNum / selectedParticipants.length)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {validationError && (
                        <p className="text-red-400 text-sm">{validationError}</p>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || createMutation.isPending}
                            className="btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                'Add Expense'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddMemberModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
    const [email, setEmail] = useState('');
    const queryClient = useQueryClient();

    const addMutation = useMutation({
        mutationFn: () => groupsApi.addMember(groupId, email),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['group', groupId] });
            toast.success('Member added!');
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to add member');
        },
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="glass-card w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Add Member</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        addMutation.mutate();
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="friend@example.com"
                            className="input-field"
                            required
                        />
                        <p className="text-sm text-slate-500 mt-2">
                            The user must already have an account
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!email || addMutation.isPending}
                            className="btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                            {addMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                'Add Member'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function SettleUpModal({
    groupId,
    settlements,
    onClose
}: {
    groupId: string;
    settlements: any[];
    onClose: () => void;
}) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [selectedSettlement, setSelectedSettlement] = useState<any>(null);
    const [amount, setAmount] = useState('');

    // Filter settlements where current user is the payer
    const userSettlements = settlements.filter(s => s.fromUserId === user?.id);

    const settleMutation = useMutation({
        mutationFn: () => settlementsApi.create(groupId, {
            toUserId: selectedSettlement.toUserId,
            amount: parseFloat(amount),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['balances', groupId] });
            queryClient.invalidateQueries({ queryKey: ['settlement-history', groupId] });
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            toast.success('Settlement recorded!');
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to record settlement');
        },
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="glass-card w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Settle Up</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {userSettlements.length === 0 ? (
                    <div className="text-center py-6">
                        <Check className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                        <p className="text-white font-medium">You're all settled up!</p>
                        <p className="text-slate-400 text-sm mt-1">You don't owe anyone in this group</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Pay to
                            </label>
                            <div className="space-y-2">
                                {userSettlements.map((s: any) => (
                                    <button
                                        key={s.toUserId}
                                        type="button"
                                        onClick={() => {
                                            setSelectedSettlement(s);
                                            setAmount(s.amount.toString());
                                        }}
                                        className={`w-full p-3 rounded-lg border text-left transition-all ${selectedSettlement?.toUserId === s.toUserId
                                                ? 'bg-blue-500/20 border-blue-500'
                                                : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-white font-medium">{s.toUserName}</span>
                                            <span className="text-blue-400">{formatCurrency(s.amount)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedSettlement && (
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Amount
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max={selectedSettlement.amount}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="input-field"
                                />
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="btn-secondary flex-1">
                                Cancel
                            </button>
                            <button
                                onClick={() => settleMutation.mutate()}
                                disabled={!selectedSettlement || !amount || settleMutation.isPending}
                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                                {settleMutation.isPending ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    'Record Payment'
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
