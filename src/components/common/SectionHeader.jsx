import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const SectionHeader = ({ title, icon, actionButton }) => {
    return (
        <div className="section-header">
            <div className="section-header-left">
                {icon && <FontAwesomeIcon icon={icon} className="section-icon" />}
                <h1 className="section-title">{title}</h1>
            </div>
            {actionButton && (
                <div className="section-header-right">
                    <button
                        className={actionButton.className || 'btn-primary'}
                        onClick={actionButton.onClick}
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