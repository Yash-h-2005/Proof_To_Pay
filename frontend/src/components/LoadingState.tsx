interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  return (
    <div className="loading-state" data-testid="loading-state">
      <div className={`spinner spinner--${size}`} />
      <span>{message}</span>
    </div>
  );
}
