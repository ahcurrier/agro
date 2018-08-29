
$(function() {
	
	var agro = function($sourceTable, options) {
		
		var o = options || {},
			a = {},

			$sourceRows = $sourceTable.find('tbody > tr'),
			$sourceCells = $sourceTable.find('tbody > tr > td'),
			
			$agro = $('<table></table>'),
			$agroCaption = $('<caption></caption>'),
			$hidden = $('<select></select>'),
			$agroHead = $('<thead></thead>'),
			$agroHeadRow = $('<tr></tr>'),
			$agroBody = $('<tbody></tbody>'),

			$categories,
			$metrics,						
			categories = [],
			metrics = [],
			renderCatCell,
			colClasses = [],
			hidden = [],
			i, um = {}, r, rs;
		
		if (o.source === undefined || o.source === 'flat') {
			
			$categories = $sourceTable.find('thead > tr:not(:last-child)');
			$metrics = $sourceTable.find('thead > tr:last-child > th + th');

			$categories.each(function() {
				var $row = $(this),
					$name = $row.find('th:first-child'),
					$terms = $row.find('th + th'),
					category = { name: $name.text().trim(), terms: [] },
					categoryId = String.fromCharCode(categories.length + 97),
					uc = {};
					
				$terms.each(function(i) {
					var $term = $(this),
						term = $term.text(),
						termIndex,
						colClass;
					if (!uc.hasOwnProperty(term)) {
						category.terms.push(term);
						uc[term] = 1;
					}
	
					termId = category.terms.indexOf(term);
					colClass = categoryId + '-' + termId;
					if (colClasses.length < i + 1) {
						colClasses.push([]);
					}
					colClasses[i].push(colClass);							
					$term.addClass(colClass);
				});
				categories.push(category);
			});
	
			$metrics.each(function(i) {
				var $metric = $(this),
					metric = $metric.text(),
					metricClass;
				if (!um.hasOwnProperty(metric)) {
					metrics.push(metric);
					um[metric] = 1;
				}
				metricClass = 'm' + metrics.indexOf(metric);
				colClasses[i].push(metricClass);
				$metric.addClass(metricClass);
			});
			
			// Apply category classes to each column
			
			for (i = 0; i < colClasses.length; i += 1) {
				$sourceCells.filter(':nth-child(' + (i + 2) + ')').attr('class', colClasses[i].join(' '));
			}					
		}
		
			
		if (o.display === undefined) {
			o.display = [];
			for(i = 0; i < categories.length; i += 1) {
				o.display.push({i:i,v:true});
			}
		}

		/*
			Render a cell in the agro table.
			Recursively renders subsequent branch cells in the tree.						
			
			$row 					Row to append cell to, if cells in this column are visible
			classChain				Array of classes corresponing to all categories subsequent data must belong to
			categoryChain			Array of category names for displaying subcategories in merged/rolled up columns
			isPreviousColVisible	Boolean, determines if previous column(s) merge/rollup into the current column
			colIndex				The index of the current column, which may or may not be visible
		*/

		renderCatCell = function($row, classChain, categoryChain, isPreviousColVisible, colIndex) {
			
			var category, termId, $cell,
				$currentRow = $row,
				cellClass, cellCategories, cellSubcategories, cellSubcategoriesHtml,
				rowspan,
				$nextRow, categoryIndex, categoryId, m, $metricCells, sum, summary, isNumber, d, isColVisible;
				
			if (colIndex < o.display.length) {
				
				// Render cell in category column

				categoryIndex = o.display[colIndex].i;
				category = categories[categoryIndex];
				categoryId = String.fromCharCode(categoryIndex + 97);
				isColVisible = o.display[colIndex].v;
				
				rowspan = (colIndex < o.display.length - 1) ? o.display[colIndex + 1].rowspan : 1;
				
				if (isPreviousColVisible) {
					cellSubcategories = [];
					cellSubcategoriesHtml = '';	
				} else {
					cellSubcategories = categoryChain;
					cellSubcategoriesHtml = '<ul><li>' + categoryChain.join('</li><li>') + '</li></ul>';
				}	
				
				for (termId = 0; termId < category.terms.length; termId += 1) {
					
					cellClass = classChain.concat(categoryId + '-' + termId);
					
					
					// To do: need to add catgory data to h4 for dragging
					
					
					cellCategories = cellSubcategories.concat('<h4 data-col="' + colIndex + '">' + category.name + '</h4>' + category.terms[termId]);
					
					if (isColVisible) {
						$cell = $('<td rowspan="' + rowspan + '">' + category.terms[termId] + cellSubcategoriesHtml + '</td>');
						$cell.data('col', colIndex).addClass(cellClass.join(' '));
						$currentRow.append($cell);
					}
					
					renderCatCell($currentRow, cellClass, cellCategories, isColVisible, colIndex + 1);
					
					if (termId < category.terms.length - 1) {
						$nextRow = $('<tr></tr>');
						$agroBody.append($nextRow);
						$currentRow = $nextRow;
					}
				}


			} else {
				
				// After all category cells have been rendered,
				// display data cells. Aggregate if necessary.
				
				for (m = 0; m < metrics.length; m += 1) {
					$metricCells = $sourceCells.filter('.m' + m + '.' + classChain.join('.'));
					if ($metricCells.length > 1) {
						sum = 0;
						summary = [];
						isNumber = true;
						$metricCells.each(function() {
							var cellValue = $(this).html() || '';
							value = parseFloat(cellValue);
							if (!isNaN(value)) {
								sum += value;
							} else {
								isNumber = false;
							}
							summary.push(cellValue);
						});
						if (isNumber) {
							metricValue = sum;
						} else {
							metricValue = summary.join('<br>');
						}
					} else {
						metricValue = $metricCells.html() || '';
					}

					$currentRow.append('<td class="m' + m + '">' + metricValue + '</td>');
					
				}
			}
		};
		
		$hidden.addClass('inactive');
		$hidden.append('<option disabled="disabled">Show hidden columns&hellip;</option>');
		$agroCaption.append($hidden);
		$agro.append($agroCaption);
		$agroHead.append($agroHeadRow);
		$agro.append($agroHead);
		$agro.append($agroBody);
		$sourceTable.after($agro);
		
		// Show hidden columns
		
		$hidden.on('change', function() {
			var parts = this.value.split('|'),
				insertIndex = parseInt((parts[1] * (o.display.length + 1)) / parts[2], 10);
			
			o.display.splice(insertIndex, 0, {i:parseInt(parts[0], 10),v:true});
			a.render();
			$hidden.find(':selected').remove();
			$hidden.children().first().prop('selected', true);
			$hidden.toggleClass('inactive', $hidden.children().length < 2);
		});

		a.render = function(renderOptions) {
			
			var ro = renderOptions || {},
				getColWidth = function(colIndex) {
				
					var c;
					
					if (colIndex !== undefined) {
						c = colIndex - 1;
					
						// console.log('3. getColWidth(' + colIndex + ')');
						// If dragging a rolled up header, width is always 1
						if (o.display[colIndex].v === false) {
							return 1;
						}
						
						while (c >= 0 && o.display[c].v === false) {
							c -= 1;
						}
						return colIndex - c;
					}
					return false;
					
				}, 
				
				moveColRange = function(fromIndex, toOriginalIndex) {
					
					var w = o.display[fromIndex].w,
						toIndex = toOriginalIndex,
						colRange, colsBefore;
					
					// If the insertion index is after the range being moved, need to shift index
					
					if (toIndex >= fromIndex + w) {
						toIndex -= w;
					}														

					colRange = o.display.splice(fromIndex - w + 1, w);
					colsBefore = o.display.splice(0, toIndex);			
					o.display = colsBefore.concat(colRange).concat(o.display);						
				},
				
				
				i;
			o.display = ro.display || o.display;

			// Calculate rowspans and widths for columns

			for (i = 0; i < o.display.length; i += 1) {
				rs = 1;
				for (r = i; r < o.display.length; r += 1) {
					categoryIndex = o.display[r].i;
					rs *= categories[categoryIndex].terms.length;
				}
				o.display[i].rowspan = rs;
				o.display[i].w = getColWidth(i);				
			}	
			
			console.log('o.display: %o', o.display);				
											
			$agroHeadRow.empty();
			$agroBody.empty();
			
			// Render table head

			$agroHeadRow.append('<th data-col="-1"><div></div></th>');
			$.each(o.display, function(i, c) {
				var $th, $h4, $hide, $edge;
				if (c.v) {
					$th = $('<th></th>');
					$h4 = $('<h4>' + categories[c.i].name + '</h4>');
					$hide = $('<span>&times;</span>');
					$edge = $('<div></div>');
					$h4.append($hide);
					$th.append($h4);
					$th.append($edge);
					$th.data('col', i);

					$agroHeadRow.append($th);
					
					// Hide column
					
					$hide.on('click', function() {
						$hidden.append('<option value="' + c.i + '|' + i + '|' + o.display.length + '">' + categories[c.i].name + '</option>');
						$hidden.removeClass('inactive');
						o.display.splice(i, 1);
						a.render();
					});
				}
			});
			
			$.each(metrics, function(i, metric) {
				$agroHeadRow.append('<th>' + metric + '</th>');
			});
			
			// Render table body

			$sourceRows.each(function(r) {
				
				var $flatRow = $(this);
					$row = $('<tr></tr>'),
					$rowName = $('<td rowspan="' + o.display[0].rowspan + '">' + $flatRow.find('td:first-child').text() + '</td>'),
					rowClass = 'r' + r;
					
				$flatRow.find('td').addClass(rowClass);
				
				$row.append($rowName);
				
				$agroBody.append($row);
				renderCatCell($row, [rowClass], [], true, 0);
				
				
			});
			
			// Get the width of a rolled up column
			// == run of consecutive v=false to the left of v=true column, plus that column
			
			getColWidth 					

			// Header drag and drop

			$agro.find('th > h4').draggable({ 
				axis: 'x', 
				revert: 'invalid', 
				revertDuration: 100 
			});
			
			$agro.find('td li > h4').draggable({
				revert: 'invalid', 
				revertDuration: 100 							
			});								

			$agro.find('th > h4').droppable({
				
				accept: function($d) {
					var dragFrom = $d.closest('th,td').data('col'),
						dragInto = $(this).parent().data('col');
					return $d.is('h4') && (dragFrom !== dragInto);
				},
				tolerance: 'pointer',
				classes: {
					'ui-droppable-hover': 'drop-into-hover'
				},
				drop: function(event, ui) {
					
					var subcatCol = ui.draggable.data('col'),
						dragFrom = (subcatCol === undefined) ? ui.draggable.closest('th,td').data('col') : subcatCol,
						dragInto = $(this).parent().data('col');

					o.display[dragFrom].v = false;

					// Check if this works when:
					// a. dragging from more than 1 away to the left - need three categories to test
					// b. dragging a rollup into a new column
					
					if (dragFrom + 1 !== dragInto) {
						if (o.display[dragFrom].w === 1) {
							o.display.splice(dragInto, 0, o.display.splice(dragFrom, 1)[0]);
						} else {
							moveColRange(dragFrom, dragInto);
						}
					}
					a.render();
				}
			});
			

			
			$agro.find('th > div').droppable({
				
				accept: function($d) {
					
					// Don'a accept drops onto adjacent edges
					
					var dragFrom, dragAfter;		
					
					// Always allow drag to edges from rolled up columns
					if ($d.data('col') !== undefined) {
						return true;
					}
					
					// Is a drag from a column head

					dragFrom = $d.closest('th,td').data('col');
					dragAfter = $(this).parent().data('col');									
					
					if (dragFrom === undefined || dragAfter === undefined) {
						// Accept callback is called one last time after drop occurs
						// When this happens, col values are undefined. Not sure why.
						return false;
					}
					
					console.log('Drag range [' + (dragFrom - o.display[dragFrom].w + 1) + ',' + dragFrom + '] after ' + dragAfter);				

					return $d.is('h4') && (dragFrom !== dragAfter) && (dragFrom !== dragAfter + o.display[dragFrom].w);
				},
				tolerance: 'pointer',
				classes: {
					'ui-droppable-hover': 'drop-edge-hover'
				},
				drop: function(event, ui) {
					var subcatCol = ui.draggable.data('col'),
						dragFrom = (subcatCol === undefined) ? ui.draggable.closest('th,td').data('col') : subcatCol,
						dragAfter = $(this).parent().data('col'),
						colRange, colsBefore;		
					
					console.log('Drop from ' + dragFrom);
					console.log('Drop after' + dragAfter);
					console.log('Drop range [' + (dragFrom - o.display[dragFrom].w + 1) + ',' + dragFrom + '] after ' + dragAfter);	
					
					
					// No matter what, the column being dropped will cease to be a rollup (if it was)						
					o.display[dragFrom].v = true;
					
					if (dragFrom !== dragAfter + 1 && o.display[dragFrom].w === 1) {
						
						// Move a single column if it's not already immediately to the left (as rollup)
						o.display.splice(dragAfter + 1, 0, o.display.splice(dragFrom, 1)[0]);
						
					} else if (o.display[dragFrom].w > 1) {
						
						// Move multiple columns (parent and rollups)
						// This implies that the column being dropped is not itself a rollup		
						moveColRange(dragFrom, dragAfter + 1);
							
					}
					a.render();
												
				}
			});	

		};
		
		a.render();
		
		return a;
	};
	
	
	var tableFromFlat = agro($('.agro.agro-flat'), { source: 'flat'/* display: [{i:0,v:true},{i:1,v:true}] */ });

	// var tableFromStacked = agro($('agro.agro-stacked'), { source: 'stacked' });

	
});

