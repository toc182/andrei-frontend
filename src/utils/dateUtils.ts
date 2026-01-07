/**
 * Format a date string to Spanish locale format
 * @param dateString - ISO date string or date-only string (YYYY-MM-DD)
 * @returns Formatted date string or '-' if invalid
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';

    // Handle different date formats
    let date: Date;
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

/**
 * Format a date to ISO string (YYYY-MM-DD)
 * @param date - Date object or string
 * @returns ISO date string
 */
export const toISODateString = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
};

/**
 * Get relative time string (e.g., "hace 2 horas")
 * @param dateString - ISO date string
 * @returns Relative time string in Spanish
 */
export const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'ahora mismo';
    if (diffMins < 60) return `hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;

    return formatDate(dateString);
};
