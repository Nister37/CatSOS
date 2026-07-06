import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// jsdom doesn't implement window.scrollTo — silence the "not implemented" error
window.scrollTo = jest.fn();
