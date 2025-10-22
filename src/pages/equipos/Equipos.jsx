import React from 'react';
import { faTruckPickup } from '@fortawesome/free-solid-svg-icons';
import SectionHeader from '../../components/common/SectionHeader';

const Equipos = () => {
    return (
        <div className="section-container">
            <SectionHeader
                title="Equipos"
                icon={faTruckPickup}
            />
        </div>
    );
};

export default Equipos;
