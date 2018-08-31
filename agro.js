(function($) {

	$.fn.agro = function(options) {

	    if (this.length > 1) {
	        this.each(function() { $(this).agro(options); });
	        return this;
	    }

		var self = this,
			o = $.extend({}, $.fn.agro.defaults, options),
			a = {},

			$sourceRows = this.find('tbody > tr'),
			$sourceCells = this.find('tbody > tr > td'),
			
			$a, $caption, $hidden, $thead, $theadRow, $tbody,
			$categories, $metrics, $categoryNames, metricCells,
			$filledCells,
			categories = [],
			metrics = [],
			renderCatCell,
			cellClasses = [],
			hidden = [],
			i, um = {}, r, rs,
			ui = {},
			items = [],
			
			aggregators = {
				'prob-or': function(values, unit) {
					
					var v, 
						s = 1,
						m = (unit == 'percent') ? 0.01 : 1.0;
					
					for(v = 0; v < values.length; v += 1) {
						s *= (1 - values[v] * m);
					}
					
					return Number.parseFloat((1 - s) / m).toFixed(2);
	
				},
				'sum': function(values) {
					return values.reduce(function(sum, n) {
						return sum + n;
					});
				}
			},
			
			getTermCellCallback = function(category) {
				
				var uc = {};

				return function(i) {
					var $term = $(this),
						termKey = $term.text().trim(),
						term = $term.html(),
						cellClass;
					if (!uc.hasOwnProperty(termKey)) {
						uc[termKey] = category.terms.length;
						category.terms.push(term);
					}

					cellClass = category.id + '-' + uc[termKey];
					if (cellClasses.length < i + 1) {
						cellClasses.push([]);
					}
					cellClasses[i].push(cellClass);							
					$term.addClass(cellClass);
				};
			},
			
			metricCellCallback = function(i) {
				var $metric = $(this),
					aggregate = $metric.data('aggregate'),
					unit = $metric.data('unit') || false,
					metricKey = $metric.text().trim(),
					metric = $metric.html(),
					cellClass;
				if (!um.hasOwnProperty(metricKey)) {
					um[metricKey] = metrics.length;
					if (aggregate === undefined || !aggregators.hasOwnProperty(aggregate)) {
						aggregate = 'sum';
					}
					metrics.push({ name: metric, unit: unit, aggregate: aggregate });
				}
				cellClass = 'm' + um[metricKey];
				cellClasses[i].push(cellClass);
				$metric.addClass(cellClass);
			};

		
		if (o.source === 'flat' || this.hasClass('agro-flat')) {
			
			// Flat source
			// Get categories, terms, and metrics from thead
			
			$categories = this.find('thead > tr:not(:last-child)');

			$categories.each(function() {
				var $row = $(this),
					$name = $row.find('th:first-child'),
					$terms = $row.find('th + th'),
					category = { id: String.fromCharCode(categories.length + 97), name: $name.html(), terms: [] },
					termCellCallback = getTermCellCallback(category);
				
				$terms.each(termCellCallback);
				categories.push(category);
			});
			
			
			$metrics = this.find('thead > tr:last-child > th + th');			
			$metrics.each(metricCellCallback);
		
			// Apply category and metric classes to each column
			
			for (i = 0; i < cellClasses.length; i += 1) {
				$sourceCells.filter(':parent:nth-child(' + (i + 2) + ')').attr('class', cellClasses[i].join(' '));
			}	
							
		} else {
			
			// Stacked source
			// Get categories and metrics from thead, get terms from tbody
			
			$categoryNames = this.find('thead th.category');
			
			$categoryNames.each(function() {
				
				var $name = $(this),
					index = $name.index() + 1,
					$terms = $sourceCells.filter(':nth-child(' + index + ')'),
					category = { id: String.fromCharCode(categories.length + 97), name: $name.html(), terms: [] },
					termCellCallback = getTermCellCallback(category);
					
				$terms.each(termCellCallback);
				categories.push(category);
					
			});

			// Apply category classes to each row
			
			metricCells = 'td:nth-child(' + ($categoryNames.length + 1) + ') ~ td:parent';
			
			$sourceRows.each(function(r) {
				$(this).find(metricCells).attr('class', cellClasses[r].join(' '));
			});
			
			$metrics = this.find('thead th + th:not(.category)');

			$metrics.each(metricCellCallback);
			
			// Apply metric classes to each column
			
			$metrics.each(function() {				
				var $metric = $(this);	
								
				$sourceCells.filter(':parent:nth-child(' + ($metric.index() + 1) + ')').addClass($metric.attr('class'));
			});

		}

		$sourceRows.each(function() {
			
			var $sourceRow = $(this),
				$rowCells = $sourceRow.find('td'),
				$itemCell = $rowCells.eq(0),
				itemKey = $itemCell.text().trim(),
				itemHtml = $itemCell.html();
				
			if (!ui.hasOwnProperty(itemKey)) {
				ui[itemKey] = items.length;
				items.push(itemHtml);
			}
			
			$rowCells.filter('[class]').addClass('i' + ui[itemKey]);
		});

		if (o.display === undefined) {
			o.display = [];
			for(i = 0; i < categories.length; i += 1) {
				o.display.push({i:i,v:true});
			}
		}
		
		if (o.aggregators !== undefined) {
			$.extend(aggregators, o.aggregators);
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
				termDescendantCount, metricFilter, metricValueCount, metricValue,
				descendantCount = 0, aggregateValues, metric,
				$nextRow, categoryIndex, m, $metricCells, aggregateValue, summary, isNumber, d, isColVisible;
				
			if (colIndex < o.display.length) {
				
				// Render cell in category column

				categoryIndex = o.display[colIndex].i;
				category = categories[categoryIndex];
				isColVisible = o.display[colIndex].v;

				if (isPreviousColVisible) {
					cellSubcategories = [];
					cellSubcategoriesHtml = '';	
				} else {
					cellSubcategories = categoryChain;
					cellSubcategoriesHtml = '<ul class="rollup"><li>' + categoryChain.join('</li><li>') + '</li></ul>';
				}	
				
				for (termId = 0; termId < category.terms.length; termId += 1) {
					
					cellClass = classChain.concat(category.id + '-' + termId);
					cellCategories = cellSubcategories.concat('<h4 data-col="' + colIndex + '">' + category.name + '</h4>' + category.terms[termId]);

					if (isColVisible) {
						$cell = $('<td></td>').appendTo($currentRow);
					}
					
					termDescendantCount = renderCatCell($currentRow, cellClass, cellCategories, isColVisible, colIndex + 1);
					descendantCount += termDescendantCount;
					
					if (isColVisible) {
						
						if (termDescendantCount > 0) {
							$cell.attr('rowspan', termDescendantCount)
								.data('col', colIndex)
								.attr('data-descendants', termDescendantCount) // debug
								.addClass(cellClass.join(' '))
								.html(category.terms[termId] + cellSubcategoriesHtml);
						} else {
							$cell.remove();
						}
					}
					
					if (termId < category.terms.length - 1 && termDescendantCount > 0) {
						$nextRow = $('<tr></tr>');
						$tbody.append($nextRow);
						$currentRow = $nextRow;
					}
				}
				
				return descendantCount;


			} else {
				
				// After all category cells have been rendered,
				// display data cells. Aggregate if necessary.
				
				metricFilter = '.' + classChain.join('.');
				metricValueCount = $sourceCells.filter(metricFilter).length;
				
				if (metricValueCount > 0) {				
					for (m = 0; m < metrics.length; m += 1) {
						metric = metrics[m];
						$metricCells = $sourceCells.filter('.m' + m + metricFilter);
						if ($metricCells.length > 1) {
							aggregateValues = [];
							summary = [];
							isNumber = true;
							$metricCells.each(function() {
								var cellValue = $(this).html() || '',
									value = parseFloat(cellValue);
								if (!Number.isNaN(value)) {
									aggregateValues.push(value);
								} else {
									isNumber = false;
								}
								summary.push(cellValue);
							});
							if (isNumber) {								
								metricValue = aggregators[metric.aggregate](aggregateValues, metric.unit);
							} else {
								metricValue = summary.join('<br>');
							}
						} else {
							metricValue = $metricCells.html() || '';
						}
	
						$currentRow.append('<td class="m' + m + '">' + metricValue + '</td>');
						
					}
					
					return 1;
					
				} else {
					
					return 0;
					
				}
			}
		};
		
		// Render the agro table structure

		$hidden = $('<select class="inactive"></select>').append('<option disabled="disabled">Show hidden columns&hellip;</option>');
		$caption = $('<caption></caption>').append($hidden);
		$theadRow = $('<tr></tr>');
		$thead = $('<thead></thead>');
		$tbody = $('<tbody></tbody>');
		
		$a = $('<table class="agro"></table>').append($caption).append($thead);

		this.after($a);
		
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
		
		// Render the agro table data

		a.render = function(renderOptions) {
			
			var ro = renderOptions || {},
				getColWidth = function(colIndex) {
				
					var c;
					
					if (colIndex !== undefined) {
						c = colIndex - 1;
					
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
					
					var w, toIndex, colRange, colsBefore;
					
					if (fromIndex + 1 !== toOriginalIndex) {
						
						w = o.display[fromIndex].w;
						toIndex = toOriginalIndex;				
						
						// If the insertion index is after the range being moved, need to shift index
						
						if (toIndex >= fromIndex + w) {
							toIndex -= w;
						}														
	
						colRange = o.display.splice(fromIndex - w + 1, w);
						colsBefore = o.display.splice(0, toIndex);			
						o.display = colsBefore.concat(colRange).concat(o.display);
					}					
				};
				
			o.display = ro.display || o.display;

			// Calculate widths for columns

			for (i = 0; i < o.display.length; i += 1) {
				o.display[i].w = getColWidth(i);				
			}	

			console.log(o.display);				
											
			$theadRow.empty().remove();
			$tbody.empty().remove();

			// Render table head

			$theadRow.append('<th data-col="-1"><div></div></th>');
			$.each(o.display, function(i, c) {
				var $th, $h4, $hide, $edge, q, k;
				if (c.v) {
					$th = $('<th></th>');
					$h4 = $('<h4>' + categories[c.i].name + '</h4>');
					$hide = $('<span>&times;</span>');
					$edge = $('<div></div>');
					$h4.append($hide);
					$th.append($h4);
					$th.append($edge);
					$th.data('col', i);

					$theadRow.append($th);
					
					// Hide column
					
					$hide.on('click', function() {

						
						for (q = i - c.w + 1; q < i + 1; q += 1) {
							k = o.display[q];
							$hidden.append('<option value="' + k.i + '|' + q + '|' + o.display.length + '">' + categories[k.i].name + '</option>');							
							
						}
						o.display.splice(i - c.w + 1, c.w);
						$hidden.removeClass('inactive');						
						
						a.render();
						$hidden.children().first().prop('selected', true);
					});
				}
			});
			
			$.each(metrics, function(i, metric) {
				$theadRow.append('<th>' + metric.name + '</th>');
			});
			
			// Render table body
			
			$.each(items, function(i, item) {				
				
				var $row = $('<tr></tr>'),
					itemClass = 'i' + i,
					$itemCell = $('<td>' + item + '</td>').appendTo($row),
					rowDescendants;
					
				$tbody.append($row);
				rowDescendants = renderCatCell($row, [itemClass], [], true, 0);
				$itemCell.attr('rowspan', rowDescendants);				
				$row.nextAll(':empty').remove();
			});	
			
			$thead.append($theadRow);
			$a.append($tbody);
						
			
			// Header drag and drop

			$a.find('th > h4').draggable({ 
				axis: 'x', 
				revert: 'invalid', 
				revertDuration: 100 
			});
			
			$a.find('td li > h4').draggable({
				revert: 'invalid', 
				revertDuration: 100 							
			});								

			$a.find('th > h4').droppable({
				
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
					
					console.log('Drop ' + (dragFrom - o.display[dragFrom].w + 1) + '-' + dragFrom + ' into ' + dragInto);	
					
					o.display[dragFrom].v = false;
					moveColRange(dragFrom, dragInto);
					a.render();
				}
			});

			$a.find('th > div').droppable({
				
				accept: function($d) {
					
					// Don't accept drops onto adjacent edges
					
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

					return $d.is('h4') && (dragFrom !== dragAfter) && (dragFrom !== dragAfter + o.display[dragFrom].w);
				},
				tolerance: 'pointer',
				classes: {
					'ui-droppable-hover': 'drop-edge-hover'
				},
				drop: function(event, ui) {
					
					var subcatCol = ui.draggable.data('col'),
						dragFrom = (subcatCol === undefined) ? ui.draggable.closest('th,td').data('col') : subcatCol,
						dragAfter = $(this).parent().data('col');	

					console.log('Drop ' + (dragFrom - o.display[dragFrom].w + 1) + '-' + dragFrom + ' after ' + dragAfter);					
										
					o.display[dragFrom].v = true; // will cease to be a rollup
					moveColRange(dragFrom, dragAfter + 1);
					a.render();												
				}
			});	

		};
		
		a.message = function() { window.alert(self.attr('class')); }

		a.render();		
		
		// Public methods can always be called via the data object
		// Examples: 
		// $collection.eq(0).data('render')();	
		// $instance.data('render')();	
		
		$.each(a, function(k, o) { self.data(k, o);	}); 
		
		// In single instances, methods can also be called via the object itself
		// Example:
		// $instance.render();
		
		$.extend(this, a);

		return this;
	};

	$(function() {

		$('.agro-source').agro();	

	});
	
})(jQuery);

