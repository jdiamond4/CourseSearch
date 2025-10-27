// Calendar rendering for schedule view

// Parse days string like "MoWeFr" or array ['Mo', 'We', 'Fr'] into array ["Mon", "Wed", "Fri"]
function parseDays(daysStr) {
    // Handle null/undefined/TBA
    if (!daysStr || daysStr === 'TBA' || daysStr === 'null' || daysStr === 'undefined') return [];
    
    const dayMap = {
        'Mo': 'Mon',
        'Tu': 'Tue',
        'We': 'Wed',
        'Th': 'Thu',
        'Fr': 'Fri',
        'Sa': 'Sat',
        'Su': 'Sun'
    };
    
    // If it's already an array, map each element
    if (Array.isArray(daysStr)) {
        return daysStr.map(day => dayMap[day] || day).filter(Boolean);
    }
    
    // Convert to string
    const daysString = String(daysStr).trim();
    if (daysString === '' || daysString === 'TBA') return [];
    
    // Parse string format like "MoWeFr"
    const days = [];
    for (let i = 0; i < daysString.length; i += 2) {
        const dayCode = daysString.substring(i, i + 2);
        if (dayMap[dayCode]) {
            days.push(dayMap[dayCode]);
        }
    }
    
    return days;
}

// Parse SIS time format "13.00.00.000000" to minutes since midnight
function parseTimeToMinutes(timeStr) {
    if (!timeStr || timeStr === 0 || timeStr === '0' || timeStr === 'TBA' || timeStr === 'null' || timeStr === 'undefined') {
        return null;
    }
    
    const str = String(timeStr).trim();
    
    if (str === '' || str === 'TBA' || str === '0') {
        return null;
    }
    
    // Handle SIS format: "13.00.00.000000"
    if (str.includes('.')) {
        const parts = str.split('.');
        const hours = parseInt(parts[0]);
        const minutes = parseInt(parts[1]);
        
        if (isNaN(hours) || isNaN(minutes)) return null;
        return hours * 60 + minutes;
    }
    
    // Fallback for other formats
    const timeNum = parseInt(str);
    if (isNaN(timeNum)) return null;
    
    const hours = Math.floor(timeNum / 100);
    const minutes = timeNum % 100;
    return hours * 60 + minutes;
}

// Format minutes since midnight to readable time
function formatMinutesToTime(minutes) {
    if (minutes === null) return 'TBA';
    
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
}

// Render the calendar
function renderCalendar() {
    const favorites = getFavorites();
    const calendarGrid = document.getElementById('calendar-grid');
    const tbaList = document.getElementById('tba-courses');
    const allCoursesList = document.getElementById('all-courses-list');
    const emptyState = document.getElementById('empty-state');
    
    if (!calendarGrid) return;
    
    // Clear existing course blocks
    const existingBlocks = calendarGrid.querySelectorAll('.course-block');
    existingBlocks.forEach(block => block.remove());
    
    // Clear TBA list
    if (tbaList) {
        tbaList.innerHTML = '';
    }
    
    // Clear all courses list
    if (allCoursesList) {
        allCoursesList.innerHTML = '';
    }
    
    // Show/hide empty state
    if (favorites.courses.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        if (tbaList) tbaList.parentElement.style.display = 'none';
        if (allCoursesList) allCoursesList.parentElement.style.display = 'none';
        return;
    } else {
        if (emptyState) emptyState.style.display = 'none';
    }
    
    const dayColumns = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const coursesByDay = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] };
    const tbaCourses = [];
    
    // Group courses by day
    favorites.courses.forEach(course => {
        const days = parseDays(course.days);
        const startMinutes = parseTimeToMinutes(course.startTime);
        const endMinutes = parseTimeToMinutes(course.endTime);
        
        if (startMinutes === null || endMinutes === null || days.length === 0) {
            tbaCourses.push(course);
            return;
        }
        
        days.forEach(day => {
            if (coursesByDay[day]) {
                // Create a fresh copy for each day to avoid reference issues
                coursesByDay[day].push({
                    courseId: course.courseId,
                    mnemonic: course.mnemonic,
                    number: course.number,
                    title: course.title,
                    sectionNumber: course.sectionNumber,
                    sectionType: course.sectionType,
                    teacherName: course.teacherName,
                    instructorGPA: course.instructorGPA,
                    startMinutes,
                    endMinutes
                });
            }
        });
    });
    
    // Render courses on calendar
    dayColumns.forEach((day, dayIndex) => {
        const courses = coursesByDay[day];
        if (!courses || courses.length === 0) return;
        
        // Sort by start time
        courses.sort((a, b) => a.startMinutes - b.startMinutes);
        
        // Detect overlaps and assign columns
        const columns = [];
        courses.forEach(course => {
            let columnIndex = 0;
            for (let i = 0; i < columns.length; i++) {
                const lastInColumn = columns[i][columns[i].length - 1];
                if (lastInColumn.endMinutes <= course.startMinutes) {
                    columnIndex = i;
                    break;
                }
                columnIndex = i + 1;
            }
            
            if (!columns[columnIndex]) {
                columns[columnIndex] = [];
            }
            columns[columnIndex].push({ ...course, columnIndex, totalColumns: 0 });
        });
        
        // Update totalColumns for each course
        const totalColumns = columns.length;
        columns.forEach(column => {
            column.forEach(course => {
                course.totalColumns = totalColumns;
            });
        });
        
        // Render each course block
        columns.flat().forEach(course => {
            const block = createCourseBlock(course, day, dayIndex);
            calendarGrid.appendChild(block);
        });
    });
    
    // Render all favorited courses list
    if (favorites.courses.length > 0 && allCoursesList) {
        const allCoursesSection = document.getElementById('all-courses-section');
        if (allCoursesSection) allCoursesSection.style.display = 'block';
        
        favorites.courses.forEach(course => {
            const item = document.createElement('div');
            item.className = `border-l-4 ${course.sectionType === 'LEC' ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'} rounded-r p-3 mb-2`;
            
            const days = parseDays(course.days);
            const startMinutes = parseTimeToMinutes(course.startTime);
            const endMinutes = parseTimeToMinutes(course.endTime);
            const hasTime = startMinutes !== null && endMinutes !== null && days.length > 0;
            const timeStr = hasTime 
                ? `${formatMinutesToTime(startMinutes)} - ${formatMinutesToTime(endMinutes)}` 
                : 'TBA';
            const daysStr = days.length > 0 ? days.join(', ') : 'TBA';
            
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-grow">
                        <div class="font-bold text-gray-800 mb-1">${course.mnemonic} ${course.number}-${course.sectionNumber}</div>
                        <div class="text-sm text-gray-600">${course.title}</div>
                        <div class="text-sm text-gray-600 mt-1">
                            <span class="font-medium">Instructor:</span> ${course.teacherName}
                            ${course.instructorGPA && course.instructorGPA !== 'N/A' ? ` | <span class="font-medium">GPA:</span> ${course.instructorGPA}` : ''}
                        </div>
                        <div class="text-sm text-gray-600">
                            <span class="font-medium">Time:</span> ${timeStr} | <span class="font-medium">Days:</span> ${daysStr}
                        </div>
                    </div>
                    <button onclick="removeFavorite('${course.courseId}'); renderCalendar();" class="text-red-600 hover:text-red-800 font-bold text-lg ml-4">×</button>
                </div>
            `;
            allCoursesList.appendChild(item);
        });
    } else if (allCoursesList) {
        const allCoursesSection = document.getElementById('all-courses-section');
        if (allCoursesSection) allCoursesSection.style.display = 'none';
    }
    
    // Render TBA courses
    if (tbaCourses.length > 0 && tbaList) {
        const tbaSection = document.getElementById('tba-section');
        if (tbaSection) tbaSection.style.display = 'block';
        tbaCourses.forEach(course => {
            const item = document.createElement('div');
            item.className = `border-l-4 ${course.sectionType === 'LEC' ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50'} rounded-r p-3 mb-2`;
            item.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-bold text-gray-800">${course.mnemonic} ${course.number}-${course.sectionNumber}</div>
                        <div class="text-sm text-gray-600">${course.title}</div>
                        <div class="text-sm text-gray-600">${course.teacherName}</div>
                    </div>
                    <button onclick="removeFavorite('${course.courseId}'); renderCalendar();" class="text-red-600 hover:text-red-800 font-bold text-lg">×</button>
                </div>
            `;
            tbaList.appendChild(item);
        });
    } else if (tbaList) {
        const tbaSection = document.getElementById('tba-section');
        if (tbaSection) tbaSection.style.display = 'none';
    }
}

// Create a course block element
function createCourseBlock(course, day, dayIndex) {
    const block = document.createElement('div');
    block.className = 'course-block';
    
    // Calculate position
    const startHour = 8; // 8 AM
    const hourHeight = 60; // pixels per hour
    
    const top = (course.startMinutes - (startHour * 60)) / 60 * hourHeight;
    const height = (course.endMinutes - course.startMinutes) / 60 * hourHeight;
    
    // Calculate left position based on day and column
    const dayWidth = 100 / 5; // 5 days
    const columnWidth = dayWidth / course.totalColumns;
    const left = (dayIndex * dayWidth) + (course.columnIndex * columnWidth);
    const width = columnWidth - 0.5; // Small gap between overlapping courses
    
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.style.left = `${left}%`;
    block.style.width = `${width}%`;
    
    // Color based on section type
    const isLecture = course.sectionType === 'LEC' || course.sectionType === 'Lecture';
    const bgColor = isLecture ? 'bg-blue-500' : 'bg-green-500';
    const hoverColor = isLecture ? 'hover:bg-blue-600' : 'hover:bg-green-600';
    
    block.className += ` ${bgColor} ${hoverColor}`;
    
    // Content
    const timeStr = `${formatMinutesToTime(course.startMinutes)} - ${formatMinutesToTime(course.endMinutes)}`;
    
    block.innerHTML = `
        <div class="text-white text-xs font-bold truncate">${course.title}</div>
        <div class="text-white text-xs truncate">${course.mnemonic} ${course.number}-${course.sectionNumber}</div>
        <div class="text-white text-xs truncate">${timeStr}</div>
        <div class="course-block-hover">
            <div class="font-bold">${course.mnemonic} ${course.number} - ${course.sectionNumber}</div>
            <div>${course.title}</div>
            <div class="mt-2">${course.teacherName}</div>
            <div>${timeStr}</div>
            ${course.instructorGPA && course.instructorGPA !== 'N/A' ? `<div class="mt-2">GPA: ${course.instructorGPA}</div>` : ''}
            <button onclick="removeFavorite('${course.courseId}'); renderCalendar();" class="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                Remove
            </button>
        </div>
    `;
    
    return block;
}

// Clear all favorites
function clearAllFavorites() {
    if (confirm('Are you sure you want to remove all courses from your schedule?')) {
        saveFavorites({ courses: [] });
        renderCalendar();
    }
}

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('calendar-grid')) {
        renderCalendar();
    }
});

