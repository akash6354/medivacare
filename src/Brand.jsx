import { Link } from "react-router-dom";

export function BrandMark() {
  return (
    <Link className="brand" to="/" aria-label="MedivaCare home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 34 34" fill="none">
          <path d="M17 3.5 29 10.3v13.4L17 30.5 5 23.7V10.3L17 3.5Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 10v14M10 17h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="17" cy="17" r="10" stroke="currentColor" strokeOpacity=".22" />
        </svg>
      </span>
      <span className="brand-name">mediva<span>care</span></span>
    </Link>
  );
}
