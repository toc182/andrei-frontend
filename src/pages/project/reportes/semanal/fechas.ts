/** Los meses cortos, en minúscula, como se escriben en las fechas del sistema. */
export const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sept', 'oct', 'nov', 'dic',
];

/** «7 al 13 de septiembre de 2026», el título de la semana. */
export function semanaLarga(inicio: string, fin: string): string {
  const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const [y1, m1, d1] = inicio.slice(0, 10).split('-').map(Number);
  const [y2, m2, d2] = fin.slice(0, 10).split('-').map(Number);
  if (m1 === m2 && y1 === y2) return `${d1} al ${d2} de ${MESES[m2 - 1]} de ${y2}`;
  if (y1 === y2) return `${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]} de ${y2}`;
  return `${d1} de ${MESES[m1 - 1]} de ${y1} al ${d2} de ${MESES[m2 - 1]} de ${y2}`;
}
