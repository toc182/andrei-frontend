import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const SectionHeader = ({ title, icon, actionButton, className }) => {
    return (
        <div className={`section-header-container ${className || ''}`}>
            <div className="section-header-left">
                {icon && <FontAwesomeIcon icon={icon} className="section-header-icon" />}
                <h1 className="section-header-title">{title}</h1>
            </div>
            {actionButton && (
                <div className="section-header-right">
                    <button
                        className={actionButton.className || 'btn-circular'}
                        onClick={actionButton.onClick}
                        title={actionButton.title}
                    >
                        {actionButton.icon && (
                            <FontAwesomeIcon icon={actionButton.icon} />
                        )}
                        {actionButton.text}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SectionHeader;