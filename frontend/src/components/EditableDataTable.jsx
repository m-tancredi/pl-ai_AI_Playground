// src/components/EditableDataTable.jsx
import React from 'react';

const EditableDataTable = ({ headers, data, onDataChange, onRowDelete, onRowAdd, maxRows = 10 }) => {
    if (!headers || headers.length === 0 || !data) {
        return <p className="text-xs text-gray-500 italic text-center py-3">No data to display or edit.</p>;
    }

    const displayedData = data.slice(0, maxRows);

    const handleInputChange = (rowIndex, header, value) => {
        onDataChange(rowIndex, header, value);
    };

    return (
        <div className="overflow-x-auto max-h-80 border rounded bg-white text-xs shadow-sm"> {/* Aumentata max-h */}
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                        {onRowDelete && <th className="px-2 py-2"></th>} {/* Colonna per bottone delete */}
                        {headers.map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {displayedData.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`} className="hover:bg-gray-50">
                            {onRowDelete && (
                                <td className="px-2 py-1 whitespace-nowrap">
                                    <button
                                        onClick={() => onRowDelete(rowIndex)}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                        title="Delete row"
                                    >
                                        × {/* Semplice 'x' per delete */}
                                    </button>
                                </td>
                            )}
                            {headers.map(header => (
                                <td key={`cell-${rowIndex}-${header}`} className="px-1 py-0.5 whitespace-nowrap">
                                    <input
                                        type="text" // O type="number" con validazione se necessario
                                        value={row[header] ?? ''} // Gestisci null/undefined
                                        onChange={(e) => handleInputChange(rowIndex, header, e.target.value)}
                                        className="w-full p-1 border border-transparent hover:border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-sm text-xs bg-transparent"
                                        placeholder="Edit..."
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {onRowAdd && (
                <div className="p-2 border-t bg-gray-50 text-center">
                    <button
                        onClick={onRowAdd}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                        + Add Row
                    </button>
                </div>
            )}
            {data.length > maxRows && <p className="text-center text-xs text-gray-400 p-1 bg-gray-50 border-t">Showing first {maxRows} rows for editing. Full dataset will be used/saved.</p>}
             {data.length === 0 && !onRowAdd && <p className="text-center text-xs text-gray-500 p-3">Dataset is empty.</p>}
        </div>
    );
};

export default EditableDataTable;