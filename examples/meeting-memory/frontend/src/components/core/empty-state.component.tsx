"use client";

import type { ReactNode } from "react";

import "./empty-state.component.css";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
};

const EmptyState = ({ icon, title, description }: EmptyStateProps) => {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h3 className="empty-state__title">{title}</h3>
      {description && (
        <p className="empty-state__description">{description}</p>
      )}
    </div>
  );
};

export { EmptyState };
export type { EmptyStateProps };
