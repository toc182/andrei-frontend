export const formatDate = (dateString) => {
    if (!dateString) return '-';
    // Fix timezone issue by treating date as local date
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-ES');
};