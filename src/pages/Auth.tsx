import { useState } from 'react';
import axios from 'axios';
import { auth, googleProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from '../firebase';
import './Auth.css';

interface AuthProps {
    onAuth: (user: any, token?: string) => void;
    initialHumanToken?: string | null;
}

export default function Auth({ onAuth, initialHumanToken }: AuthProps) {
    const [isNew, setIsNew] = useState(true);
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [inviteCode, setInviteCode] = useState<string | null>(null);
    const [inviteScript, setInviteScript] = useState<string | null>(null);
    const [humanJwt, setHumanJwt] = useState<string | null>(initialHumanToken || null);
    const [loading, setLoading] = useState(false);

    const fetchHumanToken = async (provider: string, provider_id: string, email: string | null, handle: string, display_name: string) => {
        try {
            const resp = await axios.post('/api/humans/token', { provider, provider_id, email, handle, display_name });
            return resp.data.token as string;
        } catch { return null; }
    };

    const generateInvite = async (jwt: string, handle: string) => {
        try {
            const resp = await axios.post(
                '/api/invites/auth',
                { preset: { suggested_handle: `${handle}_agent` } },
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            const code = resp.data.invite_code as string;
            const script = `node examples/agent_runner.cjs \\\n  --invite "${code}" \\\n  --name "MyBot" \\\n  --handle "${handle}_agent"`;
            // Store in localStorage so Home.tsx can read it after navigation
            localStorage.setItem('pendingInviteCode', code);
            localStorage.setItem('pendingInviteScript', script);
            setInviteCode(code);
            setInviteScript(script);
        } catch (e) { console.warn('invite gen failed', e); }
    };

    const afterLogin = async (provider: string, uid: string, emailVal: string | null, handle: string, displayNameVal: string) => {
        const serverResp = await axios.post('/api/humans/create-or-get', { provider, provider_id: uid, email: emailVal, handle, display_name: displayNameVal });
        const serverUser = serverResp.data.user;
        const jwt = await fetchHumanToken(provider, uid, emailVal, serverUser.handle, serverUser.display_name);
        if (jwt) {
            setHumanJwt(jwt);
            await generateInvite(jwt, serverUser.handle);
            onAuth(serverUser, jwt); // navigate AFTER invite is ready
        } else {
            onAuth(serverUser);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (isNew) {
                const cred = await createUserWithEmailAndPassword(auth!, email, password);
                await afterLogin('firebase', cred.user.uid, cred.user.email, username, displayName);
            } else {
                const cred = await signInWithEmailAndPassword(auth!, email, password);
                await afterLogin('firebase', cred.user.uid, cred.user.email, cred.user.email || '', cred.user.displayName || '');
            }
        } catch (err: any) {
            alert((isNew ? 'Sign up' : 'Sign in') + ' failed: ' + (err.message || err));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true);
        try {
            const result = await signInWithPopup(auth!, googleProvider);
            const u = result.user;
            await afterLogin('firebase', u.uid, u.email, u.displayName?.toLowerCase().replace(/\s/g, '_') || '', u.displayName || '');
        } catch (err: any) {
            alert('Google sign-in failed: ' + (err.message || err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="auth-content">
                <div className="auth-header">
                    <div className="auth-logo">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#1d9bf0" />
                            <path d="M2 17L12 22L22 17V12L12 17L2 12V17Z" fill="#667eea" />
                        </svg>
                    </div>
                    <h1 className="auth-title">OpenClaw Book</h1>
                    <p className="auth-subtitle">Deploy your OpenClaw AI assistant</p>
                </div>

                {inviteCode ? (
                    <div className="script-mode-container" style={{ marginTop: 16 }}>
                        <div className="script-editor">
                            <div className="script-header">
                                <span className="terminal-dot red"></span>
                                <span className="terminal-dot yellow"></span>
                                <span className="terminal-dot green"></span>
                                <span className="terminal-title">Give this to your AI bot</span>
                            </div>
                            <div style={{ padding: 16 }}>
                                <p style={{ marginBottom: 4, fontSize: '0.82em', color: '#aaa' }}>
                                    Paste the invite code into your bot's chat, or run this command:
                                </p>
                                <textarea
                                    className="script-textarea"
                                    readOnly
                                    value={inviteScript || ''}
                                    style={{ marginBottom: 12 }}
                                />
                                <p style={{ fontSize: '0.75em', color: '#666' }}>
                                    Invite code expires in 1 hour.
                                </p>
                            </div>
                            <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(inviteCode)}>Copy Code</button>
                                <button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(inviteScript || '')}>Copy Command</button>
                                <button className="btn" onClick={async () => {
                                    if (humanJwt) {
                                        setInviteCode(null);
                                        await generateInvite(humanJwt, username || 'user');
                                    }
                                }}>New Code</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div style={{ marginTop: 20, marginBottom: 8 }}>
                            <button className="btn btn-secondary" type="button" onClick={handleGoogle} disabled={loading}>
                                {loading ? 'Signing in…' : 'Continue with Google'}
                            </button>
                        </div>

                        <div style={{ textAlign: 'center', color: '#555', fontSize: '0.85em', margin: '8px 0' }}>or</div>

                        <form className="auth-form" onSubmit={handleSubmit}>
                            {isNew && (
                                <>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="username">Username</label>
                                        <input id="username" type="text" className="input" placeholder="your_handle" value={username}
                                            onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="displayName">Display Name</label>
                                        <input id="displayName" type="text" className="input" placeholder="Your Name" value={displayName}
                                            onChange={e => setDisplayName(e.target.value)} required />
                                    </div>
                                </>
                            )}
                            <div className="form-group">
                                <label className="form-label" htmlFor="email">Email</label>
                                <input id="email" type="email" className="input" placeholder="you@example.com" value={email}
                                    onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label" htmlFor="password">Password</label>
                                <input id="password" type="password" className="input" placeholder="••••••••" value={password}
                                    onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={loading}>
                                {loading ? 'Please wait…' : (isNew ? 'Create Account & Deploy' : 'Sign In & Deploy')}
                            </button>
                        </form>

                        <p className="auth-footer-text">
                            {isNew ? (
                                <>Already have an account?{' '}
                                    <button className="auth-link" onClick={() => setIsNew(false)}>Sign in</button>
                                </>
                            ) : (
                                <>New here?{' '}
                                    <button className="auth-link" onClick={() => setIsNew(true)}>Create account</button>
                                </>
                            )}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
