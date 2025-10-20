import React, { useState } from 'react';
import ProjectsList from '../components/ProjectsList';
import LicitacionesList from '../components/LicitacionesList';
import OportunidadesList from '../components/OportunidadesList';

const ProjectsHub = ({ onStatsUpdate, activeTab: propActiveTab }) => {
    const [activeTab, setActiveTab] = useState(propActiveTab || 'proyectos');
    
    // Update activeTab when prop changes
    React.useEffect(() => {
        if (propActiveTab) {
            setActiveTab(propActiveTab);
        }
    }, [propActiveTab]);

    const tabs = [
        { 
            id: 'proyectos', 
            label: 'Proyectos', 
            component: <ProjectsList onStatsUpdate={onStatsUpdate} />
        },
        { 
            id: 'licitaciones', 
            label: 'Licitaciones', 
            component: <LicitacionesList />
        },
        { 
            id: 'oportunidades', 
            label: 'Oportunidades', 
            component: <OportunidadesList />
        }
    ];

    return (
        <>
            {/* Tab Content - No navigation, only accessible from sidebar */}
            {tabs.find(tab => tab.id === activeTab)?.component}
        </>
    );
};

export default ProjectsHub;