// Every icon the app uses, imported from here rather than lucide-react.
//
// lucide-react 0.468 renders a bare <svg>, which screen readers announce as an
// unnamed "image" or "graphic". Icons here sit beside visible text or inside a
// named control, so they are decorative: hidden from assistive technology unless
// the caller gives one an aria-label of its own.
import { forwardRef, type ForwardRefExoticComponent, type RefAttributes } from "react";
import * as Lucide from "lucide-react";
import type { LucideIcon, LucideProps } from "lucide-react";

function decorative(Icon: LucideIcon): ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>> {
  const Wrapped = forwardRef<SVGSVGElement, LucideProps>((props, ref) => (
    <Icon ref={ref} aria-hidden={props["aria-label"] ? undefined : true} focusable="false" {...props} />
  ));
  Wrapped.displayName = Icon.displayName;
  return Wrapped;
}

export const Archive = decorative(Lucide.Archive);
export const ArrowLeft = decorative(Lucide.ArrowLeft);
export const ArrowRight = decorative(Lucide.ArrowRight);
export const ArrowUp = decorative(Lucide.ArrowUp);
export const ArrowUpDown = decorative(Lucide.ArrowUpDown);
export const Check = decorative(Lucide.Check);
export const ChevronDown = decorative(Lucide.ChevronDown);
export const ChevronLeft = decorative(Lucide.ChevronLeft);
export const ChevronRight = decorative(Lucide.ChevronRight);
export const CircleAlert = decorative(Lucide.CircleAlert);
export const Clock3 = decorative(Lucide.Clock3);
export const Download = decorative(Lucide.Download);
export const Expand = decorative(Lucide.Expand);
export const ExternalLink = decorative(Lucide.ExternalLink);
export const FileText = decorative(Lucide.FileText);
export const GitBranch = decorative(Lucide.GitBranch);
export const Grid2X2 = decorative(Lucide.Grid2X2);
export const Info = decorative(Lucide.Info);
export const LayoutDashboard = decorative(Lucide.LayoutDashboard);
export const Menu = decorative(Lucide.Menu);
export const MoreHorizontal = decorative(Lucide.MoreHorizontal);
export const Play = decorative(Lucide.Play);
export const Presentation = decorative(Lucide.Presentation);
export const Printer = decorative(Lucide.Printer);
export const RotateCcw = decorative(Lucide.RotateCcw);
export const Search = decorative(Lucide.Search);
export const Square = decorative(Lucide.Square);
export const TableProperties = decorative(Lucide.TableProperties);
export const TrendingUp = decorative(Lucide.TrendingUp);
export const X = decorative(Lucide.X);
