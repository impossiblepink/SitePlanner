export const PAGE_COLORS = {
  default: { title: '#f8fafc', border: null },
  blue: { title: '#60a5fa', border: '#3a556d' },
  yellow: { title: '#fcf34f', border: '#514f37' },
  pink: { title: '#f76f8f', border: '#562e39' }
};

export const pageColorFor = (value) => PAGE_COLORS[value] || PAGE_COLORS.default;
