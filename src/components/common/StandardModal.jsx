import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const StandardModal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'default', // 'small', 'default', 'large'
    className = ''
}) => {
    useEffect(() => {
        const handleEscapeKey = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscapeKey);
            document.body.classList.add('modal-open');

            // iOS Safari scroll fix
            if (/iPhone|iPad/.test(navigator.userAgent)) {
                document.body.style.overflow = 'hidden';
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
            }
        }

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
            document.body.classList.remove('modal-open');

            // Reset iOS Safari styles
            if (/iPhone|iPad/.test(navigator.userAgent)) {
                document.body.style.overflow = '';
                document.body.style.position = '';
                document.body.style.width = '';
            }
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const getSizeClass = () => {
        switch (size) {
            case 'small':
                return 'standard-modal-small';
            case 'large':
                return 'standard-modal-large';
            default:
                return '';
        }
    };

    return (
        <div className="standard-modal-overlay" onClick={handleOverlayClick}>
            <div className={`standard-modal-content ${getSizeClass()} ${className}`} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="standard-modal-header">
                    <h2>{title}</h2>
                    <button
                        className="standard-modal-close"
                        onClick={onClose}
                        type="button"
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </div>

                {/* Body */}
                <div className="standard-modal-body">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="standard-modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StandardModal;