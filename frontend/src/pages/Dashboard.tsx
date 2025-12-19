import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { groupsApi } from '../lib/api';
import { formatCurrency, getInitials } from '../lib/utils';
import {
    Users,
    Plus,
    LogOut,
    Wallet,
    TrendingUp,
    TrendingDown,
    Loader2,
    X
} from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
    const { user, logout } = useAuth();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['groups'],
        queryFn: async () => {
            const response = await groupsApi.list();
            return response.data.groups;
        },
    });

    const groups = data || [];

    // Calculate totals
    const totalOwed = groups.reduce((sum: number, g: any) =>
        g.userBalance > 0 ? sum + parseFloat(g.userBalance) : sum, 0
    );
    const totalOwes = groups.reduce((sum: number, g: any) =>
        g.userBalance < 0 ? sum + Math.abs(parseFloat(g.userBalance)) : sum, 0
    );

    return (
        <div className="min-h-screen">
            {/* Header */}
            <header className="border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-lg sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-white">SplitWise</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                                {getInitials(user?.name || 'U')}
                            </div>
                            <span className="text-slate-300 hidden sm:block">{user?.name}</span>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-6">
                {/* Balance Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    <div className="glass-card p-6 animate-fade-in">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="text-slate-400">You are owed</span>
                        </div>
                        <p className="text-3xl font-bold text-emerald-400">
                            {formatCurrency(totalOwed)}
                        </p>
                    </div>

                    <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                            </div>
                            <span className="text-slate-400">You owe</span>
                        </div>
                        <p className="text-3xl font-bold text-red-400">
                            {formatCurrency(totalOwes)}
                        </p>
                    </div>
                </div>

                {/* Groups Section */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Your Groups</h2>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        New Group
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="glass-card p-12 text-center animate-fade-in">
                        <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-slate-500" />
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">No groups yet</h3>
                        <p className="text-slate-400 mb-6">Create a group to start splitting expenses with friends</p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn-primary inline-flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Create your first group
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groups.map((group: any, index: number) => (
                            <Link
                                key={group.id}
                                to={`/groups/${group.id}`}
                                className="glass-card p-6 hover:border-blue-500/50 transition-all animate-fade-in"
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <span className="text-slate-500 text-sm">
                                        {group.members?.length || 0} members
                                    </span>
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-1">{group.name}</h3>
                                {group.description && (
                                    <p className="text-slate-400 text-sm mb-3 line-clamp-2">{group.description}</p>
                                )}
                                <div className="pt-3 border-t border-slate-700/50">
                                    <span className="text-sm text-slate-400">Your balance</span>
                                    <p className={`text-lg font-semibold ${parseFloat(group.userBalance) > 0
                                            ? 'text-emerald-400'
                                            : parseFloat(group.userBalance) < 0
                                                ? 'text-red-400'
                                                : 'text-slate-400'
                                        }`}>
                                        {parseFloat(group.userBalance) > 0 && '+'}
                                        {formatCurrency(parseFloat(group.userBalance))}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            {/* Create Group Modal */}
            {showCreateModal && (
                <CreateGroupModal onClose={() => setShowCreateModal(false)} />
            )}
        </div>
    );
}

function CreateGroupModal({ onClose }: { onClose: () => void }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const queryClient = useQueryClient();

    const createMutation = useMutation({
        mutationFn: () => groupsApi.create({ name, description }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['groups'] });
            toast.success('Group created!');
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || 'Failed to create group');
        },
    });

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="glass-card w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-white">Create New Group</h2>
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
                            Group Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Trip to Paris"
                            className="input-field"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Description (optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What's this group for?"
                            className="input-field resize-none"
                            rows={3}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name || createMutation.isPending}
                            className="btn-primary flex-1 flex items-center justify-center gap-2"
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                'Create Group'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
