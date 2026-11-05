export const siteName = 'Cabinet Designer'
export const defaultSiteUrl = 'https://cabinetdraft.vercel.app'

export function pageMetadata(pathname: string) {
  if (pathname === '/cut-list') {
    return {
      key: 'cutList' as const,
      title: 'Cabinet Cut List & PDF Export | Cabinet Designer',
      description:
        'Review panel quantities and dimensions in millimetres for your cabinet project, and download a printable PDF cut list.',
      robots: 'noindex, follow',
    }
  }
  if (pathname === '/designer' || pathname === '/') {
    return {
      key: 'designer' as const,
      title: 'Cabinet Designer — Online Cabinet Planner & Cut Lists',
      description:
        'Design DIY cabinets with shelves, doors and drawer fronts. Preview your design and export a panel cut list as PDF. Works in your browser, without an account.',
      robots: 'index, follow, max-image-preview:large',
    }
  }
  return {
    key: 'notFound' as const,
    title: 'Page Not Found | Cabinet Designer',
    description:
      'This page could not be found. Open the cabinet designer to continue.',
    robots: 'noindex, follow',
  }
}
