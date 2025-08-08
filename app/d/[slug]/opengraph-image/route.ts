import { ImageResponse } from 'next/og'
import React from 'react'

export const runtime = 'edge'

export async function GET(): Promise<ImageResponse> {
  const name = 'Vyapr Microsite'

  return new ImageResponse(
    React.createElement(
      'div',
      {
        style: {
          fontSize: 60,
          background: 'white',
          color: '#000',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '50px',
        },
      },
      name
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
