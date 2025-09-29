import React from 'react';

const StandardTable = ({ className, tableClassName, columns, data, onRowClick, emptyMessage = "No hay datos disponibles" }) => {
    return (
        <div className={`standard-table-container ${className || ''}`}>
            <table className={`standard-table ${tableClassName || ''}`}>
                <thead>
                    <tr>
                        {columns.map((column, index) => (
                            <th key={index}>
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data && data.length > 0 ? (
                        data.map((row, rowIndex) => (
                            <tr
                                key={rowIndex}
                                onClick={() => onRowClick && onRowClick(row)}
                            >
                                {columns.map((column, colIndex) => (
                                    <td key={colIndex}>
                                        {column.render ? column.render(row) : row[column.accessor]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={columns.length} className="no-data">
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default StandardTable;