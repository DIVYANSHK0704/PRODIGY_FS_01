import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// FIX #35: frontend mirrors backend password policy
const PASSWORD_POLICY = {
  minLength: 8,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /\d/,
  special: /[^A-Za-z0-9]/,
};

const validatePassword = (pwd) => {
  const errors = [];
  if (pwd.length < PASSWORD_POLICY.minLength) errors.push(`At least ${PASSWORD_POLICY.minLength} characters`);
  if (!PASSWORD_POLICY.uppercase.test(pwd)) errors.push('One uppercase letter');
  if (!PASSWORD_POLICY.lowercase.test(pwd)) errors.push('One lowercase letter');
  if (!PASSWORD_POLICY.digit.test(pwd)) errors.push('One number');
  if (!PASSWORD_POLICY.special.test(pwd)) errors.push('One special character');
  return errors;
};

const getPasswordStrength = (pwd) => {
  if (!pwd) return { label: '', color: '', width: '0%' };
  const errors = validatePassword(pwd);
  const score = 5 - errors.length;
  const levels = [
    { label: 'Very Weak', color: '#ef4444', width: '10%' },
    { label: 'Weak',      color: '#f97316', width: '25%' },
    { label: 'Fair',      color: '#eab308', width: '50%' },
    { label: 'Good',      color: '#22c55e', width: '75%' },
    { label: 'Strong',    color: '#10b981', width: '100%' },
  ];
  return levels[Math.max(0, score - 1)];
};

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const strength = getPasswordStrength(form.password);
  const pwdErrors = form.password ? validatePassword(form.password) : [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // FIX #14

    // FIX #35: enforce policy client-side too
    if (pwdErrors.length > 0) {
      return toast.error(`Password needs: ${pwdErrors[0]}`);
    }
    if (form.password !== form.confirmPassword) {
      return toast.error('Passwords do not match.');
    }

    setLoading(true);
    try {
      const data = await register({
        name: form.name.trim(),   // FIX #6
        email: form.email.trim(), // FIX #6
        password: form.password,
      });
      toast.success(data.message || 'Account created!');
      // FIX #22: registration always shows success message (server returns same msg regardless)
      if (data.token) navigate('/dashboard');
      else navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false); // FIX #14
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">✨</div>
          <h1>Create Account</h1>
          <p>Join us today — it's free</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="John Doe"
              required
              minLength={2}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <input
                type={showPass ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min. 8 chars, upper, lower, number, symbol"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button type="button" className="toggle-pass" onClick={() => setShowPass((p) => !p)} tabIndex={-1}>
                {showPass ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {form.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div className="strength-fill" style={{ width: strength.width, background: strength.color }} />
                </div>
                <span style={{ color: strength.color }}>{strength.label}</span>
              </div>
            )}
            {/* FIX #35: show policy requirements */}
            {pwdErrors.length > 0 && form.password && (
              <ul className="pwd-requirements">
                {pwdErrors.map((e) => <li key={e} className="pwd-req-fail">✗ {e}</li>)}
              </ul>
            )}
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type={showPass ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
            />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="field-error">Passwords don't match</p>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
};

export default Register;
