export const siteName = 'Cabinet Designer'
export const defaultSiteUrl = 'https://cabinetdraft.vercel.app'

export function pageMetadata(pathname: string) {
  if (pathname === '/cut-list') {
    return {
      title: 'Cabinet Cut List & PDF Export | Cabinet Designer',
      description:
        'Review panel quantities and dimensions in millimetres for your cabinet project, and download a printable PDF cut list.',
      robots: 'noindex, follow',
    }
  }
  if (pathname === '/designer' || pathname === '/') {
    return {
      title: 'Cabinet Designer — Online Cabinet Planner & Cut Lists',
      description:
        'Design DIY cabinets with shelves, doors and drawer fronts. Preview your design and export a panel cut list as PDF. Works in your browser, without an account.',
      robots: 'index, follow, max-image-preview:large',
    }
  }
  return {
    title: 'Page Not Found | Cabinet Designer',
    description:
      'This page could not be found. Open the cabinet designer to continue.',
    robots: 'noindex, follow',
  }
}
