import React, { useState } from 'react';
import ProjectsList from './ProjectsList';
import LicitacionesList from './LicitacionesList';
import OportunidadesList from './OportunidadesList';

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