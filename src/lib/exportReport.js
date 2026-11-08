// FR11: export admin reports to PDF and Excel. Libraries load only when an export is requested.
// A report is { title, columns: [{ key, label }], rows: [{...}] }.

const stamp = () => new Date().toISOString().slice(0, 10)

export async function exportPdf(reports, title = 'FarmLink report') {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(5, 64, 46)
  doc.text(title, 40, 48)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(91, 107, 97)
  doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 40, 66)
  let y = 90
  for (const r of reports) {
    if (y > 480) { doc.addPage(); y = 50 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(19, 35, 27)
    doc.text(`${r.title} (${r.rows.length})`, 40, y)
    autoTable(doc, {
      startY: y + 8,
      head: [r.columns.map((c) => c.label)],
      body: r.rows.map((row) => r.columns.map((c) => (row[c.key] ?? '').toString())),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [5, 64, 46], textColor: 255 },
      alternateRowStyles: { fillColor: [244, 246, 239] },
      margin: { left: 40, right: 40 },
    })
    y = doc.lastAutoTable.finalY + 30
  }
  doc.save(`farmlink-${title.toLowerCase().replace(/\W+/g, '-')}-${stamp()}.pdf`)
}

export async function exportExcel(reports, title = 'FarmLink report') {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const r of reports) {
    const rows = r.rows.map((row) => Object.fromEntries(r.columns.map((c) => [c.label, row[c.key] ?? ''])))
    const ws = XLSX.utils.json_to_sheet(rows, { header: r.columns.map((c) => c.label) })
    ws['!cols'] = r.columns.map((c) => ({ wch: Math.min(40, Math.max(c.label.length, ...rows.map((x) => String(x[c.label]).length)) + 2) }))
    XLSX.utils.book_append_sheet(wb, ws, r.title.slice(0, 31))
  }
  XLSX.writeFile(wb, `farmlink-${title.toLowerCase().replace(/\W+/g, '-')}-${stamp()}.xlsx`)
}
