// Print routes always render in light mode regardless of the user's theme
// preference. The wrapper div carries neither the `dark` class nor reads
// the theme context, and forces white-on-black text inline so browser
// print-color adjust passes through to the PDF.

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="light bg-white text-black"
      style={{ colorScheme: "light" }}
    >
      {children}
    </div>
  );
}
