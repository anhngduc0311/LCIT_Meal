import { useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import viLocale from "@fullcalendar/core/locales/vi";
import MdiIcon from "@/components/common/MdiIcon";
import { mdiCheck } from "@mdi/js";
import { augustRegistrations } from "./CalendarData";

type Props = {
    registrations?: string[]; // array of dates in YYYY-MM-DD format indicating registered days
    compact?: boolean; // when true, render more compact styles
};

const Calendar: React.FC<Props> = ({ registrations = augustRegistrations, compact = true }) => {
    const registrationsSet = useMemo(() => new Set(registrations || []), [registrations]);

    return (
        <div className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3 ${compact ? 'p-2' : 'p-4'}`}>
            <div className="custom-calendar">
                <FullCalendar
                    plugins={[dayGridPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{ left: "prev,next", center: "title", right: "" }}
                    locales={[viLocale]}
                    locale="vi"
                    height={compact ? 420 : 600}
                    selectable={false}
                    events={[]}
                    dayCellContent={(arg) => {
                        // arg.date is a Date object
                        const dateStr = arg.date.toISOString().split("T")[0];
                        return (
                            <div className="flex items-center justify-between px-2">
                                <div className={`text-sm ${compact ? 'text-xs' : 'text-sm'}`}>{arg.dayNumberText}</div>
                                {registrationsSet.has(dateStr) && (
                                    <>
                                        <MdiIcon path={mdiCheck} size={0.9} className="text-success-500" />
                                        <p className="text-gray-800 dark:text-gray-300">
                                            Đã đăng ký
                                        </p>
                                    </>
                                )}
                            </div>
                        );
                    }}
                />
            </div>
        </div>
    );
};

export default Calendar;
