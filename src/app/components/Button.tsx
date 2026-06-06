import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { useSound } from '../context/SoundContext';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className, children, onClick, onMouseEnter, ...props }, ref) => {
    const { play } = useSound();
    return (
      <button
        ref={ref}
        className={clsx(
          'px-8 py-4 font-heading uppercase tracking-wider transition-all active:scale-[0.97]',
          {
            'bg-accent-gold text-bg-primary glow-gold hover:brightness-110': variant === 'primary',
            'bg-transparent border border-accent-gold text-accent-gold hover:bg-accent-gold hover:text-bg-primary': variant === 'secondary',
            'bg-crimson-gradient text-text-primary hover:brightness-110': variant === 'danger',
          },
          className
        )}
        onMouseEnter={(e) => { play('hover'); onMouseEnter?.(e); }}
        onClick={(e) => { play(variant === 'danger' ? 'error' : 'click'); onClick?.(e); }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
