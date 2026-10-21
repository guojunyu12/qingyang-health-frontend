'use client';
import NextLink from 'next/link';
import type {ComponentProps} from 'react';
type Props=ComponentProps<typeof NextLink>;
export default function Link({href,...rest}:Props){
  const path=typeof href==='string'&&href.startsWith('/')&&!href.startsWith('/api/')?'/m05'+href:href;
  return <NextLink href={path} {...rest}/>;
}
