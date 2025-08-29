import React, { useState } from 'react';
import ProjectsList from './ProjectsList';
import LicitacionesList from './LicitacionesList';
import OportunidadesList from './OportunidadesList';

const ProjectsHub = ({ onStatsUpdate }) => {
    const [activeTab, setActiveTab] = useState('proyectos');

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
        <div className="space-y-4">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div>
                {tabs.find(tab => tab.id === activeTab)?.component}
            </div>
        </div>
    );
};

export default ProjectsHub;