import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
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
  onDownload,
}: {
  head: React.ReactNode
  items: {
    id: number
    rank: number
    username: string
    email: string
    score: number
  }[]
  onDownload?: () => void
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
              <TableCell>{item.email}</TableCell>
              <TableCell>{item.score}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {typeof onDownload === 'function' && (
        <div className="mt-4 text-right text-sm italic text-gray-500">
          <Button onClick={() => null}>
            <Button.Icon>
              <FontAwesomeIcon icon={faDownload} />
            </Button.Icon>
            <Button.Label>{t('shared.table.download')}</Button.Label>
          </Button>
        </div>
      )}
    </div>
  )
}

export default TableWithDownload
