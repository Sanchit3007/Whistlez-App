import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import FilterToolbar from '../../components/FilterToolbar';
import socket from '../../socket';
import { api } from '../../context/AuthContext';
import IdentityAvatar from '../../components/IdentityAvatar';

const SuperAdminUsers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const role = searchParams.get('role');
  const filterRole = role === 'admin' || role === 'superadmin' ? role : 'all';
  const [timeFilter, setTimeFilter] = useState('all');

  const fetchUsers = async () => {
    try {
      const res = await api.get('/superadmin/users');
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error('Error fetching users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Socket listener for real-time users updates
  useEffect(() => {
    socket.emit('joinSuperAdmin');

    const handleUpdate = () => {
      fetchUsers();
    };

    socket.on('usersUpdated', handleUpdate);

    return () => {
      socket.off('usersUpdated', handleUpdate);
    };
  }, []);

  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    
    let matchesTime = true;
    if (timeFilter !== 'all') {
      const createdDate = new Date(u.createdAt);
      const now = new Date();
      if (timeFilter === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesTime = createdDate >= oneWeekAgo;
      } else if (timeFilter === 'month') {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesTime = createdDate >= oneMonthAgo;
      }
    }
    
    return matchesSearch && matchesRole && matchesTime;
  });

  return (
    <div className="animated-fade-in">
      <div className="mb-4">
        <h1 className="fw-extrabold text-dark mb-1">Users Directory</h1>
        <p className="text-muted">Review credentials and profile records of accounts on the platform.</p>
      </div>

      <div className="card border-0 p-3 p-md-4 bg-white shadow-sm rounded-4">
        <FilterToolbar className="mb-4" columns={2} searchField={
            <label className="workspace-field">
              <span>Search users</span>
              <input
                type="search"
                className="form-control"
                placeholder="Name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

            </label>
        }>
          <label className="workspace-field">
            <span>Role</span>
            <select
              className="form-select"
              value={filterRole}
              onChange={(event) => {
                const nextParams = new URLSearchParams(searchParams);
                const nextRole = event.target.value;
                if (nextRole === 'all') nextParams.delete('role');
                else nextParams.set('role', nextRole);
                setSearchParams(nextParams, { replace: true });
              }}
            >
              <option value="all">All Roles</option>
              <option value="admin">Business Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>

          </label>
          <label className="workspace-field">
            <span>Registration period</span>
            <select
              className="form-select"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </label>
        </FilterToolbar>

        <div className="table-responsive">
          <table className="table table-hover align-middle">
            <thead>
              <tr className="table-light text-muted small">
                <th scope="col" style={{ width: '60px' }}>ID</th>
                <th scope="col">PROFILE</th>
                <th scope="col">NAME</th>
                <th scope="col">EMAIL</th>
                <th scope="col">ROLE</th>
                <th scope="col">PHONE NUMBER</th>
                <th scope="col">JOINED</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((u, index) => (
                  <tr key={u._id}>
                    <td><span className="text-muted">{String(filteredUsers.length - index).padStart(2, '0')}</span></td>
                    <td>
                      <IdentityAvatar name={u.name} identity={u._id || u.email} />
                    </td>
                    <td><strong className="text-dark">{u.name}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge rounded-pill workspace-status ${u.role === 'superadmin' ? 'bg-primary' : 'bg-light text-dark border'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.businessId?.phone || 'N/A'}</td>
                    <td className="text-muted small">{new Date(u.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-5 text-muted small">No user accounts found matching your queries.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminUsers;
