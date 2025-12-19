import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { Wallet, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export default function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const { login, register: registerUser } = useAuth();
    const navigate = useNavigate();

    const loginForm = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const registerForm = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const handleLogin = async (data: LoginFormData) => {
        setIsLoading(true);
        try {
            await login(data.email, data.password);
            toast.success('Welcome back!');
            navigate('/');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (data: RegisterFormData) => {
        setIsLoading(true);
        try {
            await registerUser(data.email, data.password, data.name);
            toast.success('Account created successfully!');
            navigate('/');
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo and Title */}
                <div className="text-center mb-8 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
                        <Wallet className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">SplitWise</h1>
                    <p className="text-slate-400">Split expenses with friends, simplified</p>
                </div>

                {/* Auth Card */}
                <div className="glass-card p-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    {/* Tab Switcher */}
                    <div className="flex mb-6 bg-slate-800/50 rounded-lg p-1">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all ${isLogin
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all ${!isLogin
                                ? 'bg-blue-500 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {isLogin ? (
                        <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                            <div>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        {...loginForm.register('email')}
                                        type="email"
                                        placeholder="Email address"
                                        className="input-field pl-11"
                                    />
                                </div>
                                {loginForm.formState.errors.email && (
                                    <p className="text-red-400 text-sm mt-1">
                                        {loginForm.formState.errors.email.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        {...loginForm.register('password')}
                                        type="password"
                                        placeholder="Password"
                                        className="input-field pl-11"
                                    />
                                </div>
                                {loginForm.formState.errors.password && (
                                    <p className="text-red-400 text-sm mt-1">
                                        {loginForm.formState.errors.password.message}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Sign In
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                            <div>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        {...registerForm.register('name')}
                                        type="text"
                                        placeholder="Full name"
                                        className="input-field pl-11"
                                    />
                                </div>
                                {registerForm.formState.errors.name && (
                                    <p className="text-red-400 text-sm mt-1">
                                        {registerForm.formState.errors.name.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        {...registerForm.register('email')}
                                        type="email"
                                        placeholder="Email address"
                                        className="input-field pl-11"
                                    />
                                </div>
                                {registerForm.formState.errors.email && (
                                    <p className="text-red-400 text-sm mt-1">
                                        {registerForm.formState.errors.email.message}
                                    </p>
                                )}
                            </div>

                            <div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <input
                                        {...registerForm.register('password')}
                                        type="password"
                                        placeholder="Password (min. 6 characters)"
                                        className="input-field pl-11"
                                    />
                                </div>
                                {registerForm.formState.errors.password && (
                                    <p className="text-red-400 text-sm mt-1">
                                        {registerForm.formState.errors.password.message}
                                    </p>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Create Account
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 text-sm mt-6">
                    By continuing, you agree to our Terms of Service
                </p>
            </div>
        </div>
    );
}
