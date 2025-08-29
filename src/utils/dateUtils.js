export const formatDate = (dateString) => {
    if (!dateString) return '-';
    
    // Handle different date formats
    let date;
    if (dateString.includes('T')) {
        // Already has time component
        date = new Date(dateString);
    } else {
        // Date only, add local time to avoid timezone issues
        date = new Date(dateString + 'T00:00:00');
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        return '-';
    }
    
    return date.toLocaleDateString('es-ES');
};