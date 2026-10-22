import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBriefcase, IconDotsVertical, IconFolderOff, IconPlus } from '@tabler/icons-react';
import { listProjects } from '../api/projects';
import BackButton from '../components/BackButton';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { SkeletonRows } from '../components/Skeleton';
import StatusBadge from '../components/StatusBadge';
import usePagination from '../hooks/usePagination';

const STATUS_GROUPS = [
  { value: 'not_started', label: 'Not Started', statuses: ['not_started', 'prospect'] },
  { value: 'in_progress', label: 'In Progress', statuses: ['in_progress', 'quote_accepted', 'on_going', 'active_eaas'] },
  { value: 'on_hold', label: 'On Hold', statuses: ['on_hold'] },
  { value: 'completed', label: 'Completed', statuses: ['completed'] },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled', 'rejected'] },
];

function dateLabel(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function ProjectActions({ projectId, navigate }) {
  return (
    <button
      type="button"
      className="icon-btn project-row-action"
      aria-label="Open project actions"
      title="Open project"
      onClick={(event) => {
        event.stopPropagation();
        navigate(`/projects/${projectId}`);
      }}
    >
      <IconDotsVertical size={18} />
    </button>
  );
}

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');

  useEffect(() => {
    let active = true;
    listProjects()
      .then((result) => {
        if (active) {
          setProjects(result);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Could not load projects. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const managers = useMemo(
    () => [...new Set(projects.map((project) => project.manager).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [projects]
  );
  const sectors = useMemo(
    () => [...new Set(projects.map((project) => project.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [projects]
  );
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = !normalizedSearch || [
      project.name,
      project.client_name,
      project.project_ref,
    ].some((value) => (value || '').toLocaleLowerCase().includes(normalizedSearch));
    const matchesStatus = !statusFilter || STATUS_GROUPS.find((group) => group.value === statusFilter)?.statuses.includes(project.status);
    return matchesSearch
      && matchesStatus
      && (!managerFilter || project.manager === managerFilter)
      && (!sectorFilter || project.sector === sectorFilter);
  });
  const { page, setPage, totalPages, paginated } = usePagination(filteredProjects, 12);
  const counts = STATUS_GROUPS.reduce((totals, group) => {
    totals[group.value] = projects.filter((project) => group.statuses.includes(project.status)).length;
    return totals;
  }, {});
  const hasFilters = Boolean(search || statusFilter || managerFilter || sectorFilter);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setManagerFilter('');
    setSectorFilter('');
    setPage(1);
  };

  const openProject = (projectId) => navigate(`/projects/${projectId}`);
  const handleRowKeyDown = (event, projectId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProject(projectId);
    }
  };

  return (
    <div className="projects-overview">
      <div className="page-sticky-header">
        <BackButton alwaysTo="/" label="Back to Dashboard" />
        <PageHeader
          icon={IconBriefcase}
          title="Projects"
          subtitle="Manage and track Safebox Energy projects."
          actions={
            <button type="button" className="btn btn-primary" onClick={() => navigate('/projects/new')}>
              <IconPlus size={18} /> Create Project
            </button>
          }
        />
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="stat-grid project-summary-grid">
          <button type="button" className={`stat-card stat-filter-card ${!statusFilter ? 'selected' : ''}`} aria-pressed={!statusFilter} onClick={() => { setStatusFilter(''); setPage(1); }}>
            <span><span className="stat-value">{projects.length}</span><span className="stat-label">Total Projects</span></span>
          </button>
          {STATUS_GROUPS.slice(0, 4).map((group) => (
            <button
              type="button"
              className={`stat-card stat-filter-card ${statusFilter === group.value ? 'selected' : ''}`}
              aria-pressed={statusFilter === group.value}
              onClick={() => { setStatusFilter(statusFilter === group.value ? '' : group.value); setPage(1); }}
              key={group.value}
            >
              <span><span className="stat-value">{counts[group.value]}</span><span className="stat-label">{group.label}</span></span>
            </button>
          ))}
        </div>
      )}

      <section className="project-list-section" aria-labelledby="all-projects-heading">
        <div className="project-list-toolbar">
          <div>
            <h2 id="all-projects-heading">All Projects</h2>
            {!loading && <span className="page-subtitle">{filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}</span>}
          </div>
          <div className="project-filters">
            <label className="project-search">
              <span className="sr-only">Search project, client, or reference</span>
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Search projects, clients or references…"
              />
            </label>
            <select aria-label="Filter by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {STATUS_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
            </select>
            <select aria-label="Filter by project manager" value={managerFilter} onChange={(event) => { setManagerFilter(event.target.value); setPage(1); }}>
              <option value="">All project managers</option>
              {managers.map((manager) => <option key={manager} value={manager}>{manager}</option>)}
            </select>
            <select aria-label="Filter by sector" value={sectorFilter} onChange={(event) => { setSectorFilter(event.target.value); setPage(1); }}>
              <option value="">All sectors</option>
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
            {hasFilters && <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button>}
          </div>
        </div>

        {loading ? (
          <div className="panel"><SkeletonRows rows={5} columns={7} /></div>
        ) : !error && projects.length === 0 ? (
          <EmptyState
            icon={IconFolderOff}
            title="No projects yet"
            description="Create a project to start tracking confirmed customer work."
            action={<button type="button" className="btn btn-primary" onClick={() => navigate('/projects/new')}><IconPlus size={18} /> Create Project</button>}
          />
        ) : !error && filteredProjects.length === 0 ? (
          <EmptyState icon={IconFolderOff} title="No projects match your filters" action={hasFilters && <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>} />
        ) : (
          <>
            <div className="project-table-wrap">
              <table className="data-table project-table">
                <thead>
                  <tr>
                    <th>Project Reference</th>
                    <th>Project Name</th>
                    <th>Client Name</th>
                    <th>Project Manager</th>
                    <th>Sector</th>
                    <th>Status</th>
                    <th>Date Created</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((project) => (
                    <tr
                      className="project-table-row"
                      key={project.id}
                      tabIndex={0}
                      onClick={() => openProject(project.id)}
                      onKeyDown={(event) => handleRowKeyDown(event, project.id)}
                    >
                      <td data-label="Project Reference">{project.project_ref || '—'}</td>
                      <td data-label="Project Name"><strong>{project.name}</strong></td>
                      <td data-label="Client Name">{project.client_name || '—'}</td>
                      <td data-label="Project Manager">{project.manager || '—'}</td>
                      <td data-label="Sector">{project.sector || '—'}</td>
                      <td data-label="Status"><StatusBadge type="projectStatus" value={project.status} /></td>
                      <td data-label="Date Created">{dateLabel(project.created_at)}</td>
                      <td data-label="Actions" className="project-action-cell"><ProjectActions projectId={project.id} navigate={navigate} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="project-mobile-list">
              {paginated.map((project) => (
                <article
                  className="project-mobile-card"
                  key={project.id}
                  tabIndex={0}
                  onClick={() => openProject(project.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, project.id)}
                >
                  <div className="project-mobile-card-header">
                    <h3>{project.name}</h3>
                    <ProjectActions projectId={project.id} navigate={navigate} />
                  </div>
                  <p className="project-mobile-reference">{project.project_ref || '—'}{project.client_name ? ` · ${project.client_name}` : ''}</p>
                  <div className="project-mobile-card-footer">
                    <span>{project.manager || 'Unassigned'}</span>
                    <StatusBadge type="projectStatus" value={project.status} />
                  </div>
                  <div className="project-mobile-card-meta">
                    <span>{project.sector || 'Sector not set'}</span>
                    <time dateTime={project.created_at || undefined}>{dateLabel(project.created_at)}</time>
                  </div>
                </article>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </section>
    </div>
  );
}
