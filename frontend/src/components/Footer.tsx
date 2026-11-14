import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-inverse-surface py-md mt-lg border-t border-secondary">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-md">
          <div className="flex flex-col items-center md:items-start gap-xs">
            <div className="flex items-center gap-base">
              <span className="material-symbols-outlined text-primary-container text-headline-md">pets</span>
              <span className="font-headline-md text-headline-md text-on-primary font-bold">CatSOS</span>
            </div>
            <p className="text-secondary-fixed-dim font-body-md text-body-md max-w-xs text-center md:text-left">
              A community-powered safety net for our feline friends.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-md">
            <Link
              className="text-secondary-fixed-dim font-label-md text-label-md hover:text-on-primary transition-colors"
              to="/privacy"
            >
              Privacy Policy
            </Link>
            <Link
              className="text-secondary-fixed-dim font-label-md text-label-md hover:text-on-primary transition-colors"
              to="/terms"
            >
              Terms of Service
            </Link>
            <Link
              className="text-secondary-fixed-dim font-label-md text-label-md hover:text-on-primary transition-colors"
              to="/contact"
            >
              Contact Us
            </Link>
          </div>
        </div>

        <div className="mt-md pt-sm border-t border-secondary/30 flex flex-col md:flex-row justify-between items-center gap-xs">
          <p className="text-secondary-fixed-dim font-label-sm text-label-sm">
            © 2026 CatSOS. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
