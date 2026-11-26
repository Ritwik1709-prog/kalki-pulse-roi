import React from 'react'

export function NykaaLogo({ className = 'h-5' }: { className?: string }) {
  return (
    <img
      src="/brands/nykaa-logo.svg"
      alt="Nykaa"
      draggable={false}
      className={`object-contain select-none ${className}`}
    />
  )
}

export function TiraLogo({ className = 'h-5' }: { className?: string }) {
  return (
    <img
      src="/brands/tira-logo.png"
      alt="Tira Beauty"
      draggable={false}
      className={`object-contain select-none ${className}`}
    />
  )
}

export function PurplleLogo({ className = 'h-5' }: { className?: string }) {
  return (
    <img
      src="/brands/purplle-wordmark.svg"
      alt="Purplle"
      draggable={false}
      className={`object-contain select-none ${className}`}
    />
  )
}
