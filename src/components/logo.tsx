export default function Logo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M370 353 L549 287 L730 351 L551 420 Z" stroke="none" />
        <path d="M421 394 L552 441 L679 394 L688 443 C690 458 676 468 657 476 L585 503 C563 511 539 511 517 503 L445 476 C426 468 412 457 414 442 Z" stroke="none" />
        <path d="M684 365 L684 428 L684 463" fill="none" strokeWidth="7" />
        <circle cx="684" cy="466" r="9" stroke="none" />
        <path d="M678 475 C678 475 665 498 670 517 C674 530 694 530 699 517 C704 499 690 475 690 475 Z" stroke="none" />
        <path d="M275 580 L492 551 L469 650 L438 635 L416 700 L275 580 Z" fill="white" strokeWidth="6" />
        <path d="M275 580 L469 650 L492 551 Z" fill="white" strokeWidth="6" />
        <path d="M275 580 L416 700 L438 635 Z" fill="white" strokeWidth="6" />
        <path d="M275 580 L438 635 L469 650" fill="none" strokeWidth="6" />
        <path d="M469 650 C557 651 645 626 697 573 C719 550 735 525 745 495" fill="none" strokeWidth="7" strokeDasharray="24 22" />
        <path d="M646 656 C700 636 742 603 766 560 C778 538 785 519 789 500" fill="none" strokeWidth="7" />
      </g>
    </svg>
  );
}