import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI } from '../utils/api';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user, logout, setUser } = useAuth();
  const navigate    = useNavigate();
  const [dashData,  setDashData]  = useState(null);
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState('');
  const [saving,    setSaving]    = useState(false);
  const [dashLoading, setDashLoading] = useState(true);
  // FIX #23: cancel in-flight requests on unmount
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    setDashLoading(true);
    userAPI.getDashboard({ signal: abortRef.current.signal })
      .then(({ data }) => { if (!abortRef.current.signal.aborted) setDashData(data.data); })
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          // interceptor handles 401; silently ignore other errors here
        }
      })
      .finally(() => { if (!abortRef.current.signal.aborted) setDashLoading(false); });
    return () => abortRef.current?.abort();
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { data } = await userAPI.updateProfile({ name: name.trim() });
      setUser(data.user);
      toast.success('Profile updated!');
      setEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Never';

  return (
    <div className="dashboard-page">
      <nav className="navbar">
        <div className="nav-brand"><span>🔒</span> SecureAuth</div>
        <div className="nav-actions">
          {user?.role === 'admin' && (
            <Link to="/admin" className="btn-secondary">Admin Panel</Link>
          )}
          <button onClick={handleLogout} className="btn-logout">Sign Out</button>
        </div>
      </nav>

      <div className="dashboard-container">
        <div className="welcome-banner">
          <div className="avatar">{(user?.name?.charAt?.(0) || '?').toUpperCase()}</div>
          <div>
            <h1>Welcome, {user?.name}!</h1>
            <p className="role-badge" data-role={user?.role}>{user?.role}</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">🔑</span>
            <div>
              <p className="stat-label">Total Logins</p>
              <p className="stat-value">{dashLoading ? '…' : (dashData?.loginCount ?? user?.loginCount ?? 0)}</p>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🕐</span>
            <div>
              <p className="stat-label">Last Login</p>
              <p className="stat-value">{dashLoading ? '…' : formatDate(dashData?.lastLogin)}</p>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">📅</span>
            <div>
              <p className="stat-label">Member Since</p>
              <p className="stat-value">{dashLoading ? '…' : formatDate(dashData?.memberSince)}</p>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-header">
            <h2>Profile Information</h2>
            <button
              onClick={() => { setEditing((p) => !p); setName(user?.name || ''); }}
              className="btn-edit"
            >
              {editing ? 'Cancel' : '✏️ Edit'}
            </button>
          </div>

          {editing ? (
            <form onSubmit={handleUpdateName} className="edit-form">
              <div className="form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <span className="btn-spinner" /> : 'Save Changes'}
              </button>
            </form>
          ) : (
            <div className="profile-info">
              <div className="info-row">
                <span className="info-label">Name</span>
                <span className="info-value">{user?.name}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Email</span>
                <span className="info-value">{user?.email}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Role</span>
                <span className="info-value">{user?.role}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Account Status</span>
                <span className="info-value status-active">● Active</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
