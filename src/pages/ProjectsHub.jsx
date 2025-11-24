import React from 'react';
import ProjectsList from '../components/ProjectsList';

const ProjectsHub = ({ onStatsUpdate }) => {
    return <ProjectsList onStatsUpdate={onStatsUpdate} />;
};

export default ProjectsHub;
