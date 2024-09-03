import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'

function TableWithDownload({
  head,
  items,
}: {
  head: React.ReactNode
  items: any[]
}) {
  const t = useTranslations()

  return (
    <div>
      <Table
        className=""
        containerClassName="h-fit max-h-[500px] overflow-y-auto relative"
      >
        <TableHeader className="sticky top-0 z-10 bg-white shadow-sm">
          <TableRow>{head}</TableRow>
        </TableHeader>
        <TableBody className="">
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.rank}</TableCell>
              <TableCell>{item.username}</TableCell>
              <TableCell>{item.score}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div>DOWNLOAD</div>
    </div>
  )
}

export default TableWithDownload
