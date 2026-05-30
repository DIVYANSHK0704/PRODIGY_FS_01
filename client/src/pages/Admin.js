import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { userAPI } from '../utils/api';
import toast from 'react-hot-toast';

const Admin = () => {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);
  const [pagination, setPagination] = useState(null);
  // FIX #23: AbortController to cancel in-flight requests on unmount
  const abortRef = useRef(null);

  useEffect(() => {
    // FIX #23: cancel previous request when page changes or component unmounts
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    // FIX #5: pass page param to paginated endpoint
    userAPI.getAdmin(page, 20, { signal: abortRef.current.signal })
      .then(({ data }) => {
        if (!abortRef.current.signal.aborted) setUsers(data.users);
        if (!abortRef.current.signal.aborted) setPagination(data.pagination);
      })
      .catch((err) => {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          toast.error('Failed to load users');
        }
      })
      .finally(() => { if (!abortRef.current.signal.aborted) setLoading(false); });   // FIX #14: always clear loading

    return () => abortRef.current?.abort();
  }, [page]);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="dashboard-page">
      <nav className="navbar">
        <div className="nav-brand"><span>🔒</span> SecureAuth</div>
        <div className="nav-actions">
          <Link to="/dashboard" className="btn-secondary">← Dashboard</Link>
        </div>
      </nav>

      <div className="dashboard-container">
        <div className="admin-header">
          <h1>👑 Admin Panel</h1>
          {pagination && <p>{pagination.total} total users</p>}
        </div>

        {loading ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : (
          <>
            <div className="users-table-wrap">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>User</th><th>Email</th><th>Role</th>
                    <th>Logins</th><th>Joined</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <div className="user-cell">
                          <div className="mini-avatar">{(u?.name?.charAt?.(0) || '?').toUpperCase()}</div>
                          {u.name}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td><span className="role-badge" data-role={u.role}>{u.role}</span></td>
                      <td>{u.loginCount}</td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>
                        <span className={`status-dot ${u.isActive ? 'active' : 'inactive'}`}>
                          ● {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FIX #5: pagination controls */}
            {pagination && pagination.pages > 1 && (
              <div className="pagination">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Prev
                </button>
                <span>Page {pagination.page} of {pagination.pages}</span>
                <button
                  className="btn-secondary"
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Admin;
