import React from "react";

export interface ProgressProps {
  message: string;
}

// TODO: Add back nice spinning button once it is available in radix
export function Progress({ message }: ProgressProps) {
  return <div>{message}</div>;
}

export default Progress;
